import { describe, expect, it, vi } from 'vitest';

import {
  endSubscription,
  isStripeResourceMissing,
  subscriptionsToCancel,
} from '../account-deletion.ts';

describe('subscriptionsToCancel', () => {
  it('nennt jedes Abo, das bei Stripe noch abbuchen koennte', () => {
    expect(
      subscriptionsToCancel([
        { stripe_subscription_id: 'sub_aktiv', status: 'active' },
        { stripe_subscription_id: 'sub_test', status: 'trialing' },
        // Hier versucht Stripe weiter abzubuchen - also gehoert es dazu.
        { stripe_subscription_id: 'sub_rueckstand', status: 'past_due' },
        { stripe_subscription_id: 'sub_offen', status: 'incomplete' },
      ]),
    ).toEqual(['sub_aktiv', 'sub_test', 'sub_rueckstand', 'sub_offen']);
  });

  it('laesst beendete Abos und Zeilen ohne Stripe-ID aus', () => {
    expect(
      subscriptionsToCancel([
        { stripe_subscription_id: 'sub_weg', status: 'canceled' },
        { stripe_subscription_id: 'sub_alt', status: 'expired' },
        { stripe_subscription_id: null, status: 'active' },
        { stripe_subscription_id: '', status: 'active' },
      ]),
    ).toEqual([]);
  });

  it('nennt jedes Abo nur einmal', () => {
    expect(
      subscriptionsToCancel([
        { stripe_subscription_id: 'sub_1', status: 'active' },
        { stripe_subscription_id: 'sub_1', status: 'past_due' },
      ]),
    ).toEqual(['sub_1']);
  });

  // Ein Status, den wir nicht kennen, darf nicht als "beendet" durchgehen:
  // ein vergessenes laufendes Abo ist genau der Schaden, um den es geht.
  it('behandelt einen unbekannten Status als laufend', () => {
    expect(subscriptionsToCancel([{ stripe_subscription_id: 'sub_neu', status: 'irgendwas' }])).toEqual([
      'sub_neu',
    ]);
  });
});

describe('isStripeResourceMissing', () => {
  it('erkennt ein bei Stripe unbekanntes Objekt', () => {
    expect(isStripeResourceMissing({ code: 'resource_missing' })).toBe(true);
    expect(isStripeResourceMissing({ statusCode: 404 })).toBe(true);
  });

  it('haelt alles andere fuer einen echten Fehler', () => {
    expect(isStripeResourceMissing(new Error('network'))).toBe(false);
    expect(isStripeResourceMissing({ statusCode: 429 })).toBe(false);
    expect(isStripeResourceMissing(null)).toBe(false);
  });
});

describe('endSubscription', () => {
  it('beendet das Abo sofort', async () => {
    const api = { cancel: vi.fn().mockResolvedValue({}), retrieve: vi.fn() };

    expect(await endSubscription(api, 'sub_1')).toBe(true);
    expect(api.cancel).toHaveBeenCalledWith('sub_1');
    expect(api.retrieve).not.toHaveBeenCalled();
  });

  it('ist zufrieden, wenn Stripe das Abo nicht kennt', async () => {
    const api = { cancel: vi.fn().mockRejectedValue({ code: 'resource_missing' }), retrieve: vi.fn() };

    expect(await endSubscription(api, 'sub_1')).toBe(true);
  });

  it('ist zufrieden, wenn das Abo bei Stripe schon beendet ist', async () => {
    const api = {
      cancel: vi.fn().mockRejectedValue(new Error('already canceled')),
      retrieve: vi.fn().mockResolvedValue({ status: 'canceled' }),
    };

    expect(await endSubscription(api, 'sub_1')).toBe(true);
  });

  // Der Fall, um den es geht: Stripe ist nicht erreichbar, das Abo laeuft.
  // Dann darf das Konto nicht geloescht werden.
  it('meldet false, wenn das Abo weiterlaeuft', async () => {
    const api = {
      cancel: vi.fn().mockRejectedValue(new Error('rate limit')),
      retrieve: vi.fn().mockResolvedValue({ status: 'active' }),
    };

    expect(await endSubscription(api, 'sub_1')).toBe(false);
  });

  it('meldet false, wenn sich der Stand nicht einmal nachsehen laesst', async () => {
    const api = {
      cancel: vi.fn().mockRejectedValue(new Error('network')),
      retrieve: vi.fn().mockRejectedValue(new Error('network')),
    };

    expect(await endSubscription(api, 'sub_1')).toBe(false);
  });
});
