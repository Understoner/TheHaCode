import { describe, expect, it } from 'vitest';

import { isFresh } from './fresh';

describe('isFresh', () => {
  const now = new Date('2026-11-02T12:00:00Z');

  it('Beitraege der letzten 14 Tage sind neu', () => {
    expect(isFresh('2026-11-01T08:00:00Z', now)).toBe(true);
    expect(isFresh('2026-10-20T12:00:01Z', now)).toBe(true);
  });

  it('aeltere, kuenftige und undatierte nicht', () => {
    expect(isFresh('2026-10-19T12:00:00Z', now)).toBe(false);
    expect(isFresh('2026-11-03T12:00:00Z', now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
    expect(isFresh('kein Datum', now)).toBe(false);
  });
});
