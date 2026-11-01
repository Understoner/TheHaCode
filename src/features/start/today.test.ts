import { describe, expect, it } from 'vitest';

import { dayOfYear, dayTime, IMPULSE_COUNT, impulseIndex, moonPhase } from './today';

describe('Startseite: Tag, Impuls, Mond', () => {
  it('Tag im Jahr', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 10, 1))).toBe(305);
  });

  it('Impulse laufen im Kreis und bleiben im Bereich', () => {
    expect(impulseIndex(new Date(2026, 0, 1))).toBe(1);
    expect(impulseIndex(new Date(2026, 0, IMPULSE_COUNT + 1))).toBe(1);
    for (let d = 1; d <= 366; d++) {
      const i = impulseIndex(new Date(2028, 0, d));
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(IMPULSE_COUNT);
    }
  });

  it('Tageszeit', () => {
    expect(dayTime(new Date(2026, 10, 1, 7))).toBe('morning');
    expect(dayTime(new Date(2026, 10, 1, 14))).toBe('day');
    expect(dayTime(new Date(2026, 10, 1, 22))).toBe('evening');
    expect(dayTime(new Date(2026, 10, 1, 2))).toBe('evening');
  });

  it('Mondphase an bekannten Tagen', () => {
    // Vollmond 5. November 2025, Neumond 20. November 2025.
    expect(moonPhase(new Date(Date.UTC(2025, 10, 5, 12)))).toBe('full');
    expect(moonPhase(new Date(Date.UTC(2025, 10, 20, 12)))).toBe('new');
    expect(moonPhase(new Date(Date.UTC(2025, 10, 12, 12)))).toBe('waning');
    expect(moonPhase(new Date(Date.UTC(2025, 10, 27, 12)))).toBe('waxing');
  });
});
