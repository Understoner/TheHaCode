import { describe, expect, it } from 'vitest';

import { formatCourseDate, formatCourseStart } from './schedule';

describe('Kurstermine', () => {
  it('zeigt die Kurzform mit oesterreichischem Monatsnamen', () => {
    // 19.01.2027, 19:00 Ortszeit (Winterzeit, also 18:00 UTC)
    expect(formatCourseDate('2027-01-19T18:00:00Z')).toBe('19. Jänner 2027');
  });

  it('zeigt in der Langform Wochentag und Uhrzeit', () => {
    const lang = formatCourseStart('2026-10-13T17:00:00Z');
    expect(lang).toContain('Dienstag');
    expect(lang).toContain('13. Oktober 2026');
    expect(lang).toContain('19:00');
  });

  // Der Kursabend beginnt um 19:00 im Kursraum, nicht um 19:00 beim Leser.
  // Ohne feste Zeitzone haenge das Ergebnis daran, wo der Browser steht.
  it('rechnet Sommer- und Winterzeit auf Wiener Ortszeit', () => {
    expect(formatCourseStart('2026-09-29T17:00:00Z')).toContain('19:00');
    expect(formatCourseStart('2026-11-10T18:00:00Z')).toContain('19:00');
  });

  it('kommt ohne Termin und mit unbrauchbarem Wert zurecht', () => {
    expect(formatCourseDate(null)).toBeNull();
    expect(formatCourseStart(null)).toBeNull();
    expect(formatCourseDate('kein Datum')).toBeNull();
  });
});
