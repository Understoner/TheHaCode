import { describe, expect, it } from 'vitest';

import { scoreFor, type ScoreCategory, type ScoreEntry } from './score';

// Atmung wie im Startbestand (docs/inhalte/habit-score-tracker.sql).
const atmung: ScoreCategory = {
  id: 'atmung',
  isNegative: false,
  maxPerDay: 20,
  maxPerWeek: 100,
  maxPerMonth: 400,
};

// Eine kuenftige Abzugs-Kategorie ("Zuckerattacke").
const zucker: ScoreCategory = {
  id: 'zucker',
  isNegative: true,
  maxPerDay: 15,
  maxPerWeek: 40,
  maxPerMonth: 120,
};

function done(date: string, points = 10, categoryId = 'atmung'): ScoreEntry {
  return { categoryId, points, date };
}

// 2026-10-19 ist ein Montag.
const MO = '2026-10-19';

describe('scoreFor - Tag', () => {
  it('zaehlt die Punkte der erledigten Habits', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO)]);
    expect(score.total).toBe(10);
    expect(score.maxTotal).toBe(20);
  });

  it('deckelt auf das Tageslimit der Kategorie', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO), done(MO), done(MO)]);
    expect(score.categories[0].value).toBe(20);
    expect(score.total).toBe(20);
  });

  it('zaehlt nur den angefragten Tag', () => {
    const score = scoreFor('day', MO, [atmung], [done('2026-10-18'), done('2026-10-20')]);
    expect(score.total).toBe(0);
  });

  it('zieht bei negativen Kategorien ab, ebenfalls gedeckelt', () => {
    const score = scoreFor(
      'day',
      MO,
      [atmung, zucker],
      [done(MO), done(MO, 10, 'zucker'), done(MO, 10, 'zucker')],
    );
    expect(score.categories.find((c) => c.categoryId === 'zucker')?.value).toBe(-15);
    expect(score.total).toBe(-5);
  });

  // Die Entscheidung vom 25.10.2026: ins Minus ja, aber nie weiter, als das
  // positive Maximum reicht.
  it('faellt nie unter das negative Tagesmaximum der positiven Kategorien', () => {
    const viel: ScoreCategory = { ...zucker, maxPerDay: 50, maxPerWeek: 50, maxPerMonth: 50 };
    const score = scoreFor('day', MO, [atmung, viel], [done(MO, 50, 'zucker')]);
    expect(score.categories.find((c) => c.categoryId === 'zucker')?.value).toBe(-50);
    expect(score.total).toBe(-20);
  });

  it('ignoriert Eintraege aus Kategorien, die es nicht (mehr) gibt', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO, 10, 'weg')]);
    expect(score.total).toBe(0);
  });

  it('macht aus negativen Punkten keinen Abzug in einer positiven Kategorie', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO, -10)]);
    expect(score.total).toBe(0);
  });

  it('liefert 0 und nicht -0, wenn nichts eingetragen ist', () => {
    const score = scoreFor('day', MO, [atmung, zucker], []);
    expect(Object.is(score.total, 0)).toBe(true);
    expect(Object.is(score.categories[1].value, 0)).toBe(true);
  });
});

describe('scoreFor - Woche', () => {
  it('summiert die gedeckelten Tage von Montag bis Sonntag', () => {
    // Montag dreifach erledigt (gedeckelt 20), Mittwoch einmal (10).
    const entries = [done(MO), done(MO), done(MO), done('2026-10-21')];
    const score = scoreFor('week', '2026-10-23', [atmung], entries);
    expect(score.total).toBe(30);
    expect(score.maxTotal).toBe(100);
  });

  it('deckelt auf das Wochenlimit - fuenf volle Tage reichen', () => {
    const entries = ['19', '20', '21', '22', '23', '24', '25'].flatMap((d) => [
      done(`2026-10-${d}`),
      done(`2026-10-${d}`),
    ]);
    const score = scoreFor('week', MO, [atmung], entries);
    expect(score.total).toBe(100);
  });

  it('zaehlt den Sonntag davor nicht zur Woche', () => {
    const score = scoreFor('week', MO, [atmung], [done('2026-10-18')]);
    expect(score.total).toBe(0);
  });

  it('begrenzt den Abzug der Woche auf das positive Wochenmaximum', () => {
    const viel: ScoreCategory = { ...zucker, maxPerDay: 200, maxPerWeek: 500, maxPerMonth: 500 };
    const score = scoreFor('week', MO, [atmung, viel], [done(MO, 200, 'zucker'), done('2026-10-20', 200, 'zucker')]);
    expect(score.total).toBe(-100);
  });
});

describe('scoreFor - Monat', () => {
  it('summiert alle Tage des Kalendermonats, auch ueber Wochengrenzen', () => {
    // 31.10. ist ein Samstag, 1.11. ein Sonntag - dieselbe Woche, zwei Monate.
    const entries = [done('2026-10-01'), done('2026-10-31'), done('2026-11-01')];
    expect(scoreFor('month', '2026-10-15', [atmung], entries).total).toBe(20);
    expect(scoreFor('month', '2026-11-15', [atmung], entries).total).toBe(10);
  });

  it('deckelt auf das Monatslimit', () => {
    const entries = Array.from({ length: 31 }, (_, i) => {
      const day = `2026-10-${String(i + 1).padStart(2, '0')}`;
      return [done(day), done(day)];
    }).flat();
    expect(scoreFor('month', '2026-10-01', [atmung], entries).total).toBe(400);
  });

  it('rechnet den Monat aus den Tagen, nicht aus gedeckelten Wochen', () => {
    // Eine Woche mit 7 vollen Tagen (140, als Woche auf 100 gedeckelt) zaehlt
    // im Monat mit 140: das Monatslimit ist die Grenze, nicht die Woche.
    const entries = ['19', '20', '21', '22', '23', '24', '25'].flatMap((d) => [
      done(`2026-10-${d}`),
      done(`2026-10-${d}`),
    ]);
    expect(scoreFor('month', MO, [atmung], entries).total).toBe(140);
  });
});
