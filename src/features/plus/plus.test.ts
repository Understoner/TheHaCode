import { describe, expect, it } from 'vitest';

import { formatAmount, formatDate, subscriptionView, yearlySavingPercent } from './plus';
import type { Subscription } from './usePlus';

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    plan: 'monthly',
    status: 'active',
    current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    cancel_at_period_end: false,
    ...overrides,
  } as Subscription;
}

describe('formatAmount', () => {
  it('zeigt Cent als Betrag mit Waehrung', () => {
    const preis = formatAmount(990, 'eur');
    expect(preis).toContain('9,90');
    expect(preis).toContain('€');
  });

  it('nimmt die Waehrung, wie Stripe sie liefert - klein geschrieben', () => {
    expect(() => formatAmount(1000, 'eur')).not.toThrow();
  });
});

describe('yearlySavingPercent', () => {
  it('rechnet die Ersparnis gegen zwoelf Monate', () => {
    // 12 × 9,90 = 118,80 gegen 99,00 -> 16,66 %
    expect(
      yearlySavingPercent([
        { plan: 'monthly', amountCents: 990, currency: 'eur', interval: 'month' },
        { plan: 'yearly', amountCents: 9900, currency: 'eur', interval: 'year' },
      ]),
    ).toBe(16);
  });

  // Bei einer Werbeaussage ueber Geld ist die unguenstigere Rundung die
  // richtige: 16,66 % werden zu 16, nicht zu 17.
  it('rundet ab, nicht kaufmaennisch', () => {
    const prozent = yearlySavingPercent([
      { plan: 'monthly', amountCents: 1000, currency: 'eur', interval: 'month' },
      { plan: 'yearly', amountCents: 10000, currency: 'eur', interval: 'year' },
    ]);
    expect(prozent).toBe(16); // 16,67 %
  });

  it('schweigt, wenn der Jahrestarif nichts spart', () => {
    expect(
      yearlySavingPercent([
        { plan: 'monthly', amountCents: 990, currency: 'eur', interval: 'month' },
        { plan: 'yearly', amountCents: 11880, currency: 'eur', interval: 'year' },
      ]),
    ).toBeNull();
  });

  it('schweigt, wenn ein Tarif fehlt', () => {
    expect(
      yearlySavingPercent([{ plan: 'monthly', amountCents: 990, currency: 'eur', interval: 'month' }]),
    ).toBeNull();
  });
});

describe('subscriptionView', () => {
  it('ohne Abo gibt es nichts zu zeigen', () => {
    expect(subscriptionView(null)).toEqual({ state: 'none' });
    expect(subscriptionView(undefined)).toEqual({ state: 'none' });
  });

  it('ein laufendes Abo laeuft', () => {
    expect(subscriptionView(sub()).state).toBe('active');
  });

  it('gekuendigt heisst: laeuft noch, verlaengert sich aber nicht', () => {
    expect(subscriptionView(sub({ cancel_at_period_end: true })).state).toBe('ending');
  });

  // Der Fall, der ohne Periodenpruefung still falsch waere: Stripe hat das
  // Ereignis nicht geliefert, die Zeile steht noch auf 'active', die Periode
  // ist aber vorbei. Dieselbe Strenge wie in entitlement.ts.
  it('ein abgelaufenes "active" ist beendet, nicht aktiv', () => {
    const abgelaufen = sub({ current_period_end: new Date(Date.now() - 86_400_000).toISOString() });
    expect(subscriptionView(abgelaufen).state).toBe('ended');
  });

  it('gekuendigt und abgelaufen ist beendet', () => {
    expect(subscriptionView(sub({ status: 'canceled' })).state).toBe('ended');
  });

  it('past_due wird zum Zahlungsproblem, nicht zu "kein Abo"', () => {
    const view = subscriptionView(sub({ status: 'past_due' }));
    expect(view.state).toBe('problem');
  });

  it('reicht den Tarif durch', () => {
    const view = subscriptionView(sub({ plan: 'yearly' }));
    expect(view.state === 'active' && view.plan).toBe('yearly');
  });
});

describe('formatDate', () => {
  it('schreibt ein Datum aus', () => {
    expect(formatDate('2026-12-24T10:00:00.000Z')).toMatch(/2026/);
  });

  it('macht aus nichts nichts', () => {
    expect(formatDate(null)).toBe('');
  });
});
