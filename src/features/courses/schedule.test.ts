import { describe, expect, it } from 'vitest';

import {
  courseDay,
  formatCourseDate,
  formatCourseStart,
  isInCoursePeriod,
  isPastCourse,
  parseCoursePeriod,
  periodRange,
} from './schedule';

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

describe('Zeitraum-Filter', () => {
  // Freitag, 30.10.2026, mittags in Wien.
  const now = new Date('2026-10-30T11:00:00Z');

  it('rechnet die Zeitraeume in Wiener Kalendertagen', () => {
    expect(periodRange('alle', now)).toBeNull();
    expect(periodRange('woche', now)).toEqual(['2026-10-30', '2026-11-01']);
    expect(periodRange('monat', now)).toEqual(['2026-10-30', '2026-10-31']);
    expect(periodRange('naechsterMonat', now)).toEqual(['2026-11-01', '2026-11-30']);
    expect(periodRange('dreiMonate', now)).toEqual(['2026-10-30', '2027-01-29']);
  });

  it('filtert nach Termin und laesst Kurse ohne Termin immer stehen', () => {
    expect(isInCoursePeriod('2026-11-01T18:00:00Z', 'woche', now)).toBe(true);
    expect(isInCoursePeriod('2026-11-02T18:00:00Z', 'woche', now)).toBe(false);
    expect(isInCoursePeriod('2026-11-15T18:00:00Z', 'naechsterMonat', now)).toBe(true);
    expect(isInCoursePeriod('2026-12-01T18:00:00Z', 'naechsterMonat', now)).toBe(false);
    expect(isInCoursePeriod(null, 'woche', now)).toBe(true);
  });

  // 23:30 UTC am 30.11. ist in Wien schon der 1.12. - massgeblich ist Wien.
  it('rechnet nach dem Wiener Tag, nicht nach UTC', () => {
    expect(isInCoursePeriod('2026-11-30T22:30:00Z', 'naechsterMonat', now)).toBe(true);
    expect(isInCoursePeriod('2026-11-30T23:30:00Z', 'naechsterMonat', now)).toBe(false);
  });

  it('nimmt aus der Adresse nur bekannte Zeitraeume', () => {
    expect(parseCoursePeriod('monat')).toBe('monat');
    expect(parseCoursePeriod('gestern')).toBe('alle');
    expect(parseCoursePeriod(undefined)).toBe('alle');
  });
});

