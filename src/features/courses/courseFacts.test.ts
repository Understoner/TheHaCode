import { describe, expect, it } from 'vitest';

import {
  courseCalendar,
  courseEvenings,
  courseKind,
  courseSections,
  courseShortTitle,
  courseTheme,
  shortEvening,
} from './courseFacts';

describe('courseKind', () => {
  it('liest Online aus dem Ort, Anheften als "Für dich"', () => {
    expect(courseKind({ is_pinned: false, location: 'Online' })).toBe('online');
    expect(courseKind({ is_pinned: false, location: 'Mittelschule Buchkirchen' })).toBe('vorort');
    expect(courseKind({ is_pinned: false, location: null })).toBe('vorort');
    expect(courseKind({ is_pinned: true, location: 'Online' })).toBe('mass');
  });
});

describe('courseTheme und courseShortTitle', () => {
  it('erkennt die vier Themen der Online-Reihe', () => {
    expect(courseTheme('DER ATEMCODE – ONLINE: Balance')).toBe('balance');
    expect(courseTheme('DER ATEMCODE – ONLINE: Energy')).toBe('energy');
    expect(courseTheme('DER ATEMCODE – ONLINE: Relax')).toBe('relax');
    expect(courseTheme('DER ATEMCODE – ONLINE: Funktionale Atmung')).toBe('funktional');
    expect(courseTheme('Besser atmen – besser leben')).toBeNull();
  });

  it('kuerzt den Reihen-Vorspann weg', () => {
    expect(courseShortTitle('DER ATEMCODE – ONLINE: Funktionale Atmung')).toBe('Funktionale Atmung');
    expect(courseShortTitle('Besser atmen – besser leben')).toBe('Besser atmen – besser leben');
  });
});

describe('courseCalendar', () => {
  it('rechnet in Wiener Zeit, auch ueber die Zeitumstellung', () => {
    // 18:00 UTC im Oktober (Sommerzeit) = 20:00 in Wien
    expect(courseCalendar('2026-10-05T18:00:00+00:00')).toMatchObject({
      monthKey: '2026-10',
      day: 5,
      weekday: 'Mo',
      time: '20:00',
    });
    // 19:00 UTC im November (Winterzeit) = 20:00 in Wien
    expect(courseCalendar('2026-11-09T19:00:00+00:00')).toMatchObject({ monthKey: '2026-11', day: 9, time: '20:00' });
    // Kurz vor Mitternacht UTC ist in Wien schon der naechste Tag
    expect(courseCalendar('2026-12-31T23:30:00+00:00')?.monthKey).toBe('2027-01');
  });

  it('nennt den Jänner österreichisch', () => {
    expect(courseCalendar('2027-01-19T18:00:00+00:00')?.monthShort).toBe('JÄN');
  });

  it('gibt ohne Termin null', () => {
    expect(courseCalendar(null)).toBeNull();
    expect(courseCalendar('kein Datum')).toBeNull();
  });
});

const VHS = `## Worum es geht

Erfahren Sie, wie Atmung wirkt.

## Termine

Vier Abende, jeweils dienstags von 19:00 bis 20:30 Uhr:

- Dienstag, 10. November 2026
- Dienstag, 17. November 2026
- Dienstag, 24. November 2026
- Dienstag, 1. Dezember 2026

## Anmeldung

Über die VHS.`;

describe('courseSections und courseEvenings', () => {
  it('teilt den Langtext an den Ueberschriften', () => {
    const sections = courseSections(VHS, 'Über den Kurs');
    expect(sections.map((s) => s.title)).toEqual(['Worum es geht', 'Termine', 'Anmeldung']);
  });

  it('nimmt Text vor der ersten Ueberschrift als Einleitung', () => {
    expect(courseSections('Kurz vorweg.\n\n## Ablauf\n\nSo.', 'Über den Kurs')).toEqual([
      { title: 'Über den Kurs', body: 'Kurz vorweg.' },
      { title: 'Ablauf', body: 'So.' },
    ]);
    expect(courseSections(null, 'x')).toEqual([]);
  });

  it('liest die Abende samt Uhrzeit', () => {
    const evenings = courseEvenings(courseSections(VHS, 'x'));
    expect(evenings).toEqual({
      dates: [
        'Dienstag, 10. November 2026',
        'Dienstag, 17. November 2026',
        'Dienstag, 24. November 2026',
        'Dienstag, 1. Dezember 2026',
      ],
      from: '19:00',
      to: '20:30',
    });
  });

  it('zeigt keine Zeitleiste ohne Abschnitt oder mit nur einem Abend', () => {
    expect(courseEvenings(courseSections('## Ablauf\n\n- eins\n- zwei', 'x'))).toBeNull();
    expect(courseEvenings(courseSections('## Termine\n\n- Montag, 9. November 2026', 'x'))).toBeNull();
  });

  it('kuerzt einen Abend fuer die Zeitleiste', () => {
    expect(shortEvening('Dienstag, 10. November 2026')).toBe('Di, 10. November');
    expect(shortEvening('irgendwann')).toBe('irgendwann');
  });
});
