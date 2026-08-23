import { describe, expect, it } from 'vitest';

import { formatCourseDate, formatCourseStart, courseDay, isPastCourse } from './schedule';

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

describe('isPastCourse', () => {
  // Wien, nicht die Zone des Ausfuehrenden: die Tests setzen deshalb feste
  // Zeitpunkte in UTC und rechnen die Erwartung von Hand nach.
  const heute = new Date('2026-10-19T09:00:00Z'); // 19.10.2026, 11:00 in Wien

  it('blendet einen Termin von gestern aus', () => {
    expect(isPastCourse('2026-10-18T18:00:00Z', heute)).toBe(true);
  });

  it('zeigt den heutigen Termin noch, auch wenn seine Uhrzeit vorbei ist', () => {
    // 19.10. um 08:00 Wien - laengst vorbei, aber derselbe Tag.
    expect(isPastCourse('2026-10-19T06:00:00Z', heute)).toBe(false);
  });

  it('zeigt kuenftige Termine', () => {
    expect(isPastCourse('2026-10-26T19:00:00Z', heute)).toBe(false);
  });

  it('haelt einen Kurs ohne Termin fuer nicht vergangen', () => {
    expect(isPastCourse(null, heute)).toBe(false);
  });

  it('faellt bei unlesbarem Datum auf sichtbar zurueck statt zu verstecken', () => {
    expect(isPastCourse('kein datum', heute)).toBe(false);
  });

  it('rechnet den Tageswechsel in Wien, nicht in UTC', () => {
    // 19.10.2026 23:30 Wien ist 21:30 UTC. Ein Termin um 22:30 UTC waere in
    // UTC schon der 20., in Wien aber noch der 20. um 00:30 - also kuenftig.
    const spaetAbends = new Date('2026-10-19T21:30:00Z');
    expect(courseDay(spaetAbends)).toBe('2026-10-19');
    expect(isPastCourse('2026-10-19T16:00:00Z', spaetAbends)).toBe(false);
  });
});
