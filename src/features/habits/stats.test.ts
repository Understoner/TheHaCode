import { describe, expect, it } from 'vitest';

import { addDays, monthDays, toIsoDate, weekStart } from './dates';
import {
  daysDoneThisWeek,
  minutesPerWeek,
  monthHeat,
  movingAverage,
  streakWithGrace,
  trendSummary,
  weekHeat,
} from './stats';

// 2026-10-25 ist ein Sonntag, 2026-10-19 der Montag davor.
const SO = '2026-10-25';

describe('dates', () => {
  it('findet den Montag der Woche, auch vom Sonntag aus', () => {
    expect(weekStart(SO)).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });

  // In der Nacht auf den 25.10.2026 endet die Sommerzeit. Wer mit 24 Stunden
  // in Millisekunden rechnet, landet hier im falschen Tag.
  it('zaehlt ueber die Zeitumstellung hinweg richtig', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('kennt die Laenge der Monate, auch im Schaltjahr', () => {
    expect(monthDays('2026-02-10')).toHaveLength(28);
    expect(monthDays('2028-02-10')).toHaveLength(29);
    expect(monthDays('2026-10-10').at(-1)).toBe('2026-10-31');
  });

  it('liest den Kalendertag in Ortszeit, nicht in UTC', () => {
    expect(toIsoDate(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-25');
  });
});

describe('daysDoneThisWeek', () => {
  it('zaehlt die Tage der laufenden Woche bis heute', () => {
    const done = new Set(['2026-10-18', '2026-10-19', '2026-10-21', '2026-10-22']);
    expect(daysDoneThisWeek(done, '2026-10-22')).toBe(3);
  });
});

describe('streakWithGrace', () => {
  it('ist 0 ohne Eintraege', () => {
    expect(streakWithGrace(new Set(), SO).days).toBe(0);
  });

  it('laesst heute offen, solange der Tag nicht vorbei ist', () => {
    const done = new Set(['2026-10-22', '2026-10-23', '2026-10-24']);
    expect(streakWithGrace(done, SO).days).toBe(3);
  });

  it('verzeiht einen freien Tag je Woche', () => {
    // Mi frei, sonst Mo bis So erledigt.
    const done = new Set(['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24', SO]);
    const streak = streakWithGrace(done, SO);
    expect(streak.days).toBe(6);
    expect(streak.graceUsedThisWeek).toBe(true);
  });

  it('bricht beim zweiten freien Tag derselben Woche', () => {
    // Di und Do frei: die Serie reicht nur bis Fr zurueck - Do wird
    // verziehen, Di nicht mehr.
    const done = new Set(['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-24', SO]);
    expect(streakWithGrace(done, SO).days).toBe(4);
  });

  it('gewaehrt in jeder Woche einen eigenen freien Tag', () => {
    // Vorwoche: Mi frei. Diese Woche: Mi frei.
    const done = new Set<string>();
    for (let d = '2026-10-12'; d <= SO; d = addDays(d, 1)) {
      if (d !== '2026-10-14' && d !== '2026-10-21') done.add(d);
    }
    expect(streakWithGrace(done, SO).days).toBe(12);
  });

  it('reicht nicht vor den ersten Eintrag zurueck', () => {
    const done = new Set([SO]);
    expect(streakWithGrace(done, SO)).toEqual({ days: 1, graceUsedThisWeek: false });
  });
});

describe('weekHeat', () => {
  it('liefert Montag bis Sonntag mit denselben Stufen wie der Monat', () => {
    const counts = new Map([
      ['2026-10-19', 2],
      ['2026-10-21', 1],
    ]);
    // Mittwoch als heute: Donnerstag bis Sonntag liegen in der Zukunft.
    const week = weekHeat('2026-10-21', counts, 2);
    expect(week.map((d) => d.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(week.map((d) => d.level)).toEqual([4, 0, 2, 0, 0, 0, 0]);
    expect(week.map((d) => d.isFuture)).toEqual([false, false, false, true, true, true, true]);
  });
});

describe('monthHeat', () => {
  it('stuft den Tag nach dem Anteil erledigter Habits ein', () => {
    const counts = new Map([
      ['2026-10-01', 1],
      ['2026-10-02', 2],
    ]);
    const heat = monthHeat('2026-10-15', counts, 2, SO);
    expect(heat).toHaveLength(31);
    expect(heat[0]).toMatchObject({ level: 2, done: 1 });
    expect(heat[1]).toMatchObject({ level: 4, done: 2 });
    expect(heat[2].level).toBe(0);
    expect(heat[25].isFuture).toBe(true);
  });

  it('zeigt einen Eintrag auch dann, wenn heute kein Habit mehr gewaehlt ist', () => {
    const heat = monthHeat('2026-10-15', new Map([['2026-10-01', 1]]), 0, SO);
    expect(heat[0].level).toBe(4);
  });
});

describe('BOLT-Verlauf', () => {
  it('bildet den Schnitt ueber sieben Kalendertage, nicht ueber sieben Messungen', () => {
    const trend = movingAverage([
      { date: '2026-10-01', value: 10 },
      { date: '2026-10-20', value: 20 },
      { date: '2026-10-21', value: 30 },
    ]);
    expect(trend.map((p) => p.average)).toEqual([10, 20, 25]);
  });

  it('nennt Bestwert und Veraenderung seit der ersten Messung', () => {
    expect(
      trendSummary([
        { date: '2026-10-21', value: 24 },
        { date: '2026-10-01', value: 18 },
        { date: '2026-10-10', value: 27 },
      ]),
    ).toEqual({ best: 27, first: 18, latest: 24, change: 6 });
  });

  it('liefert ohne Messung nichts statt einer Null', () => {
    expect(trendSummary([]).best).toBeNull();
  });
});

describe('minutesPerWeek', () => {
  it('summiert die Minuten je Woche, aelteste Woche zuerst', () => {
    const weeks = minutesPerWeek(
      [
        { started_at: '2026-10-20', duration_seconds: 546 },
        { started_at: '2026-10-24', duration_seconds: 180 },
        { started_at: '2026-10-13', duration_seconds: 300 },
        { started_at: '2026-10-13', duration_seconds: null },
        { started_at: '2025-01-01', duration_seconds: 900 },
      ],
      SO,
      (timestamp) => timestamp,
      3,
    );
    expect(weeks).toEqual([
      { weekStart: '2026-10-05', minutes: 0 },
      { weekStart: '2026-10-12', minutes: 5 },
      { weekStart: '2026-10-19', minutes: 12 },
    ]);
  });
});
