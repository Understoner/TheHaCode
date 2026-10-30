import { describe, expect, it } from 'vitest';

import {
  categoryComparison,
  habitConsistency,
  weekdayPattern,
  type AnalysisHabit,
  type AnalysisLog,
} from './analysis';

// 2026-10-30 ist ein Freitag.
const HEUTE = '2026-10-30';

function habit(id: string, overrides: Partial<AnalysisHabit> = {}): AnalysisHabit {
  return {
    id,
    categoryId: 'atmung',
    isNegative: false,
    isActive: true,
    startedOn: '2026-01-01',
    ...overrides,
  };
}

const log = (habitId: string, date: string): AnalysisLog => ({ habitId, date });

describe('categoryComparison', () => {
  const habits = [
    habit('atempause'),
    habit('bolt'),
    habit('alkohol', { categoryId: 'ernaehrung', isNegative: true }),
  ];

  it('trennt den laufenden Zeitraum vom Zeitraum davor', () => {
    const result = categoryComparison(
      habits,
      [
        log('atempause', HEUTE),
        log('bolt', HEUTE),
        log('atempause', '2026-10-03'), // erster Tag des laufenden Zeitraums
        log('atempause', '2026-10-02'), // letzter Tag davor
        log('atempause', '2026-09-05'), // erster Tag davor
        log('atempause', '2026-09-04'), // zu alt
      ],
      HEUTE,
    );
    expect(result).toEqual([
      {
        categoryId: 'atmung',
        current: { positive: 3, negative: 0, activeDays: 2 },
        previous: { positive: 2, negative: 0, activeDays: 2 },
      },
    ]);
  });

  it('zaehlt Abzuege getrennt und nicht als aktiven Tag', () => {
    const [ernaehrung] = categoryComparison(habits, [log('alkohol', '2026-10-29')], HEUTE);
    expect(ernaehrung.current).toEqual({ positive: 0, negative: 1, activeDays: 0 });
  });

  it('laesst Kategorien ohne Eintrag und Eintraege in der Zukunft weg', () => {
    expect(categoryComparison(habits, [log('atempause', '2026-10-31')], HEUTE)).toEqual([]);
  });
});

describe('weekdayPattern', () => {
  it('zaehlt positive Eintraege je Wochentag, Montag zuerst', () => {
    const counts = weekdayPattern(
      [habit('atempause'), habit('alkohol', { isNegative: true })],
      [
        log('atempause', '2026-10-26'), // Montag
        log('atempause', '2026-10-19'), // Montag
        log('atempause', HEUTE), // Freitag
        log('alkohol', '2026-10-27'), // zieht ab, zaehlt nicht
      ],
      HEUTE,
    );
    expect(counts).toEqual([2, 0, 0, 0, 1, 0, 0]);
  });

  it('schaut nur `weeks` Wochen zurueck', () => {
    // 8 Wochen bis Freitag, 30.10., beginnen am Samstag, 5.9.
    const counts = weekdayPattern(
      [habit('a')],
      [log('a', '2026-09-05'), log('a', '2026-09-04')],
      HEUTE,
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('habitConsistency', () => {
  it('zaehlt Tage, laengste und laufende Serie', () => {
    const [result] = habitConsistency(
      [habit('a')],
      [
        log('a', '2026-10-10'),
        log('a', '2026-10-11'),
        log('a', '2026-10-12'),
        log('a', '2026-10-28'),
        log('a', '2026-10-29'),
      ],
      HEUTE,
    );
    expect(result).toEqual({
      habitId: 'a',
      doneDays: 5,
      windowDays: 28,
      longestStreak: 3,
      // Heute ist noch offen: die Serie bis gestern steht.
      currentStreak: 2,
      daysSinceLast: 1,
    });
  });

  it('verkuerzt den Zeitraum fuer ein Habit, das spaeter dazukam', () => {
    const [result] = habitConsistency(
      [habit('a', { startedOn: '2026-10-26' })],
      [log('a', '2026-10-26'), log('a', HEUTE)],
      HEUTE,
    );
    expect(result).toMatchObject({ doneDays: 2, windowDays: 5, currentStreak: 1, daysSinceLast: 0 });
  });

  it('nimmt nachgetragene Tage vor der Aufnahme in den Zeitraum', () => {
    const [result] = habitConsistency(
      [habit('a', { startedOn: '2026-10-29' })],
      [log('a', '2026-10-27')],
      HEUTE,
    );
    expect(result).toMatchObject({ doneDays: 1, windowDays: 4 });
  });

  it('kennt kein letztes Mal ohne Eintrag und laesst herausgenommene Habits weg', () => {
    const result = habitConsistency([habit('a'), habit('b', { isActive: false })], [], HEUTE);
    expect(result).toEqual([
      { habitId: 'a', doneDays: 0, windowDays: 28, currentStreak: 0, longestStreak: 0, daysSinceLast: null },
    ]);
  });
});
