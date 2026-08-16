import { describe, it, expect } from 'vitest';

import {
  checkoutFacts,
  isRelevantEvent,
  mapSubscription,
  periodEndFromSubscription,
  planFromSubscription,
  statusFromStripe,
  subscriptionIdFromInvoice,
  userIdFromCheckoutSession,
  type StripeSubscriptionLike,
} from '../stripe-events.ts';

const USER = 'c0000000-0000-0000-0000-000000000001';
const PERIOD_END_UNIX = 1_790_000_000; // 2026-09-21T09:33:20Z
const PERIOD_END_ISO = new Date(PERIOD_END_UNIX * 1000).toISOString();

function subscription(overrides: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike {
  return {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_123',
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_end: PERIOD_END_UNIX,
    items: { data: [{ price: { recurring: { interval: 'year' } } }] },
    metadata: { user_id: USER },
    ...overrides,
  };
}

describe('isRelevantEvent', () => {
  it('kennt die sechs Ereignisse aus SAD §4.3', () => {
    expect(isRelevantEvent('checkout.session.completed')).toBe(true);
    expect(isRelevantEvent('customer.subscription.deleted')).toBe(true);
    expect(isRelevantEvent('invoice.payment_failed')).toBe(true);
  });

  it('alles andere geht uns nichts an', () => {
    expect(isRelevantEvent('payment_intent.succeeded')).toBe(false);
    expect(isRelevantEvent('customer.created')).toBe(false);
  });
});

describe('userIdFromCheckoutSession', () => {
  it('leitet die user_id ausschliesslich aus client_reference_id ab, nie aus der E-Mail', () => {
    const session = {
      id: 'cs_123',
      client_reference_id: USER,
      // Direkt daneben, und bewusst ignoriert: eine Adresse kann jemand
      // anders eintragen, die client_reference_id setzen wir selbst.
      customer_email: 'fremde@person.at',
    };
    expect(userIdFromCheckoutSession(session)).toBe(USER);
  });

  it('wirft, wenn client_reference_id fehlt - lieber 500 und Stripe-Retry als falsche Zuordnung', () => {
    expect(() => userIdFromCheckoutSession({ id: 'cs_123' })).toThrow();
  });

  it('eine leere client_reference_id zaehlt als fehlend', () => {
    expect(() => userIdFromCheckoutSession({ id: 'cs_123', client_reference_id: '' })).toThrow();
  });
});

describe('checkoutFacts', () => {
  it('holt Nutzer, Session, Abo und Kaeuferland heraus', () => {
    expect(
      checkoutFacts({
        id: 'cs_123',
        client_reference_id: USER,
        subscription: 'sub_123',
        customer_details: { address: { country: 'AT' } },
      }),
    ).toEqual({
      userId: USER,
      checkoutSessionId: 'cs_123',
      subscriptionId: 'sub_123',
      country: 'AT',
    });
  });

  it('kommt mit ausgepackten Verweisen zurecht', () => {
    expect(
      checkoutFacts({ id: 'cs_123', client_reference_id: USER, subscription: { id: 'sub_123' } })
        .subscriptionId,
    ).toBe('sub_123');
  });

  it('ohne Abo in der Session bleibt die Abo-ID leer', () => {
    expect(checkoutFacts({ id: 'cs_123', client_reference_id: USER }).subscriptionId).toBeNull();
  });
});

describe('statusFromStripe', () => {
  it('bildet die bekannten Werte ab', () => {
    expect(statusFromStripe('active')).toBe('active');
    expect(statusFromStripe('trialing')).toBe('trialing');
    expect(statusFromStripe('canceled')).toBe('canceled');
    expect(statusFromStripe('incomplete')).toBe('incomplete');
    expect(statusFromStripe('incomplete_expired')).toBe('expired');
  });

  it('unpaid und paused heissen "zahlt gerade nicht" und damit past_due', () => {
    expect(statusFromStripe('unpaid')).toBe('past_due');
    expect(statusFromStripe('paused')).toBe('past_due');
  });

  it('ein unbekannter Status gewaehrt nie Zugriff', () => {
    // Der eigentliche Punkt: fuehrt Stripe einen neuen Status ein, darf daraus
    // niemals ein Zugriff werden. 'expired' zaehlt in entitlement.ts nicht.
    expect(statusFromStripe('irgendwas_neues')).toBe('expired');
    expect(statusFromStripe('')).toBe('expired');
  });
});

describe('planFromSubscription', () => {
  it('Jahresintervall ergibt yearly', () => {
    expect(planFromSubscription(subscription())).toBe('yearly');
  });

  it('Monatsintervall ergibt monthly', () => {
    expect(
      planFromSubscription(
        subscription({ items: { data: [{ price: { recurring: { interval: 'month' } } }] } }),
      ),
    ).toBe('monthly');
  });

  it('ohne erkennbares Intervall bleibt es beim guenstigeren Monat', () => {
    expect(planFromSubscription(subscription({ items: { data: [] } }))).toBe('monthly');
  });
});

describe('periodEndFromSubscription', () => {
  it('liest das Periodenende vom Abo', () => {
    expect(periodEndFromSubscription(subscription())).toBe(PERIOD_END_ISO);
  });

  it('liest es auch von der Position - dort steht es seit API-Version 2025-03-31', () => {
    const sub = subscription({
      current_period_end: null,
      items: {
        data: [{ price: { recurring: { interval: 'year' } }, current_period_end: PERIOD_END_UNIX }],
      },
    });
    expect(periodEndFromSubscription(sub)).toBe(PERIOD_END_ISO);
  });

  it('wirft, wenn es an beiden Stellen fehlt - ein geratenes Datum waere hier das Schlimmste', () => {
    expect(() =>
      periodEndFromSubscription(subscription({ current_period_end: null, items: { data: [] } })),
    ).toThrow();
  });
});

describe('subscriptionIdFromInvoice', () => {
  it('findet das Abo direkt auf der Rechnung', () => {
    expect(subscriptionIdFromInvoice({ subscription: 'sub_123' })).toBe('sub_123');
  });

  it('findet es unter parent.subscription_details', () => {
    expect(
      subscriptionIdFromInvoice({
        parent: { subscription_details: { subscription: 'sub_123' } },
      }),
    ).toBe('sub_123');
  });

  it('findet es an der Rechnungsposition', () => {
    expect(subscriptionIdFromInvoice({ lines: { data: [{ subscription: 'sub_123' }] } })).toBe(
      'sub_123',
    );
  });

  it('eine Rechnung ohne Abo geht uns nichts an', () => {
    expect(subscriptionIdFromInvoice({})).toBeNull();
  });
});

describe('mapSubscription', () => {
  it('baut die Zeile fuer public.subscriptions', () => {
    expect(mapSubscription(subscription())).toEqual({
      user_id: USER,
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      plan: 'yearly',
      status: 'active',
      current_period_end: PERIOD_END_ISO,
      cancel_at_period_end: false,
      canceled_at: null,
    });
  });

  it('setzt bei customer.subscription.deleted den Status auf canceled', () => {
    const sub = subscription({ status: 'canceled', canceled_at: PERIOD_END_UNIX });
    const row = mapSubscription(sub);
    expect(row.status).toBe('canceled');
    expect(row.canceled_at).toBe(PERIOD_END_ISO);
  });

  it('wirft, wenn weder metadata.user_id noch eine uebergebene ID da ist', () => {
    expect(() => mapSubscription(subscription({ metadata: {} }))).toThrow();
  });

  it('die uebergebene Nutzer-ID sticht die aus den Metadaten', () => {
    // Beim Checkout ist client_reference_id die verbindliche Quelle.
    const sub = subscription({ metadata: { user_id: 'falsch' } });
    expect(mapSubscription(sub, { userId: USER }).user_id).toBe(USER);
  });

  it('laesst country weg, wenn keins mitkommt - sonst wuerde jedes Folgeereignis es leeren', () => {
    // Das Kaeuferland steht nur an der Checkout-Session. Ein Upsert schreibt
    // nur die uebergebenen Spalten; fehlt der Schluessel, bleibt der
    // gespeicherte Wert stehen.
    expect(mapSubscription(subscription())).not.toHaveProperty('country');
    expect(mapSubscription(subscription(), { country: 'AT' }).country).toBe('AT');
    expect(mapSubscription(subscription(), { country: null })).not.toHaveProperty('country');
  });

  it('nimmt die Session-ID nur auf, wenn es eine gibt', () => {
    expect(mapSubscription(subscription())).not.toHaveProperty('stripe_checkout_session_id');
    expect(
      mapSubscription(subscription(), { checkoutSessionId: 'cs_123' }).stripe_checkout_session_id,
    ).toBe('cs_123');
  });

  it('kommt mit einem ausgepackten Kundenobjekt zurecht', () => {
    expect(mapSubscription(subscription({ customer: { id: 'cus_999' } })).stripe_customer_id).toBe(
      'cus_999',
    );
  });
});
