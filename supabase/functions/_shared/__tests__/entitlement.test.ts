import { describe, it, expect } from 'vitest';

import { hasActiveSubscription, type SubRow } from '../entitlement.ts';

const NOW = new Date('2026-07-26T12:00:00Z');
const future = '2026-08-26T12:00:00Z';
const past = '2026-06-26T12:00:00Z';

describe('hasActiveSubscription', () => {
  it('ohne Abo kein Zugriff', () => {
    expect(hasActiveSubscription([], NOW)).toBe(false);
  });

  it('aktives Jahresabo mit laufender Periode', () => {
    expect(
      hasActiveSubscription([{ plan: 'yearly', status: 'active', current_period_end: future }], NOW),
    ).toBe(true);
  });

  it('aktives Abo mit abgelaufener Periode zaehlt nicht - schuetzt vor ausgebliebenem Webhook', () => {
    expect(
      hasActiveSubscription([{ plan: 'monthly', status: 'active', current_period_end: past }], NOW),
    ).toBe(false);
  });

  it('past_due gewaehrt keinen Zugriff', () => {
    expect(
      hasActiveSubscription(
        [{ plan: 'monthly', status: 'past_due', current_period_end: future }],
        NOW,
      ),
    ).toBe(false);
  });

  it('gekuendigt zum Periodenende: Status bleibt active, Zugriff bleibt bis zum Ende', () => {
    expect(
      hasActiveSubscription(
        [{ plan: 'monthly', status: 'active', current_period_end: future }],
        NOW,
      ),
    ).toBe(true);
  });

  it('sofort gekuendigt: kein Zugriff trotz zukuenftigem Periodenende', () => {
    expect(
      hasActiveSubscription(
        [{ plan: 'monthly', status: 'canceled', current_period_end: future }],
        NOW,
      ),
    ).toBe(false);
  });

  it('exakt zum Ablaufzeitpunkt endet der Zugriff', () => {
    expect(
      hasActiveSubscription(
        [{ plan: 'monthly', status: 'active', current_period_end: NOW.toISOString() }],
        NOW,
      ),
    ).toBe(false);
  });

  it('von mehreren Abos genuegt eines, das traegt', () => {
    const subs: SubRow[] = [
      { plan: 'monthly', status: 'canceled', current_period_end: past },
      { plan: 'yearly', status: 'active', current_period_end: future },
    ];
    expect(hasActiveSubscription(subs, NOW)).toBe(true);
  });
});
