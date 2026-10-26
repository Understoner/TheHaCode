import { describe, expect, it } from 'vitest';

import { activeCategoriesByMonth, scoreFor, type ScoreCategory, type ScoreEntry } from './score';

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

// ---------------------------------------------------------------------------
// Aktive Kategorien und das Jahr (Entscheidung 25.10.2026, zweite Runde)
// ---------------------------------------------------------------------------

const bewegung: ScoreCategory = { ...atmung, id: 'bewegung' };
const schlaf: ScoreCategory = { ...atmung, id: 'schlaf' };
const sieben = [atmung, bewegung, schlaf];

describe('activeCategoriesByMonth', () => {
  it('zaehlt ein gewaehltes Habit fuer jeden Monat, in dem es gewaehlt war', () => {
    const active = activeCategoriesByMonth(
      [{ categoryId: 'atmung', startedOn: '2026-08-15', archivedOn: '2026-10-02' }],
      [],
    );
    expect(active('2026-07').has('atmung')).toBe(false);
    expect(active('2026-08').has('atmung')).toBe(true);
    expect(active('2026-10').has('atmung')).toBe(true);
    expect(active('2026-11').has('atmung')).toBe(false);
  });

  it('zaehlt auch eine Kategorie, in der nur eingetragen wurde', () => {
    const active = activeCategoriesByMonth([], [done('2026-10-05', 10, 'schlaf')]);
    expect([...active('2026-10')]).toEqual(['schlaf']);
    expect(active('2026-09').size).toBe(0);
  });
});

describe('scoreFor - nur aktive Kategorien', () => {
  it('rechnet das Maximum nur aus den aktiven Kategorien', () => {
    const active = activeCategoriesByMonth(
      [{ categoryId: 'atmung', startedOn: '2026-10-01', archivedOn: null }],
      [],
    );
    const day = scoreFor('day', MO, sieben, [done(MO)], active);
    expect(day.maxTotal).toBe(20);
    expect(day.categories.map((c) => c.categoryId)).toEqual(['atmung']);
  });

  // Wer Bewegung waehlt und nie eintraegt, soll sich das Maximum nicht
  // schoenrechnen: die Kategorie zaehlt mit, auch mit 0 Punkten.
  it('zaehlt eine gewaehlte Kategorie ohne Eintrag ins Maximum', () => {
    const active = activeCategoriesByMonth(
      [
        { categoryId: 'atmung', startedOn: '2026-10-01', archivedOn: null },
        { categoryId: 'bewegung', startedOn: '2026-10-01', archivedOn: null },
      ],
      [],
    );
    const month = scoreFor('month', MO, sieben, [done(MO)], active);
    expect(month.maxTotal).toBe(800);
    expect(month.total).toBe(10);
  });
});

describe('scoreFor - Jahr', () => {
  const ganzesJahr = activeCategoriesByMonth(
    [{ categoryId: 'atmung', startedOn: '2026-01-01', archivedOn: null }],
    [],
  );

  it('summiert die Monate von Jaenner bis zum Ankermonat, jeden gedeckelt', () => {
    // Maerz: 31 Tage zu je 20 Punkten = 620, gedeckelt auf 400.
    const maerz = Array.from({ length: 31 }, (_, i) =>
      done(`2026-03-${String(i + 1).padStart(2, '0')}`, 20),
    );
    const year = scoreFor('year', '2026-10-25', [atmung], [...maerz, done('2026-10-20', 10)], ganzesJahr);
    expect(year.categories[0].value).toBe(410);
    expect(year.categories[0].max).toBe(10 * 400);
    expect(year.maxTotal).toBe(4000);
  });

  it('zaehlt im Maximum nur die Monate, in denen die Kategorie aktiv war', () => {
    const abOktober = activeCategoriesByMonth(
      [
        { categoryId: 'atmung', startedOn: '2026-01-01', archivedOn: null },
        { categoryId: 'schlaf', startedOn: '2026-10-01', archivedOn: null },
      ],
      [],
    );
    const year = scoreFor('year', '2026-10-25', sieben, [], abOktober);
    expect(year.maxTotal).toBe(10 * 400 + 1 * 400);
    expect(year.categories.map((c) => c.categoryId)).toEqual(['atmung', 'schlaf']);
  });

  it('zaehlt das Vorjahr nicht mit', () => {
    const year = scoreFor('year', '2026-02-10', [atmung], [done('2025-12-31', 20)], ganzesJahr);
    expect(year.total).toBe(0);
  });
});

// Seit 26.10.2026 (0028) haengt das Vorzeichen am Habit: dieselbe Kategorie
// bringt Punkte und zieht ab. Gewinn und Abzug werden je fuer sich gedeckelt.
function bad(date: string, points = 6, categoryId = 'atmung'): ScoreEntry {
  return { categoryId, points, date, isNegative: true };
}

describe('scoreFor - negative Habits in einer normalen Kategorie', () => {
  it('zieht ab, und die Kategorie kann ins Minus gehen', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO, 4), bad(MO, 10)]);
    expect(score.categories[0].value).toBe(-6);
    expect(score.total).toBe(-6);
    // Das Maximum bleibt das der Kategorie - ein Abzug-Habit aendert P nicht.
    expect(score.maxTotal).toBe(20);
  });

  it('deckelt den Abzug getrennt auf das Tageslimit', () => {
    const score = scoreFor('day', MO, [atmung], [bad(MO, 10), bad(MO, 10), bad(MO, 10)]);
    expect(score.categories[0].value).toBe(-20);
  });

  // Der Kern der Regel: ein Ueberschuss ueber dem Limit verschluckt den
  // Abzug nicht. 30 gesammelt, gedeckelt 20, minus 10 = 10 - nicht 20.
  it('verrechnet erst nach dem Deckeln, damit kein Abzug im Ueberschuss verschwindet', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO), done(MO), done(MO), bad(MO, 10)]);
    expect(score.categories[0].value).toBe(10);
  });

  it('deckelt in der Woche Gewinn und Abzug je fuer sich', () => {
    // Fuenf Tage voller Abzug (je 20) = 100, Wochenlimit 100; dazu 20 Gewinn.
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
    const entries = [...days.flatMap((d) => [bad(d, 10), bad(d, 10)]), done(MO, 20)];
    const week = scoreFor('week', MO, [atmung], entries);
    expect(week.categories[0].value).toBe(20 - 100);
  });

  it('rechnet im Jahr Monat fuer Monat, Gewinn und Abzug getrennt', () => {
    const ganzesJahr = activeCategoriesByMonth(
      [{ categoryId: 'atmung', startedOn: '2026-01-01', archivedOn: null }],
      [],
    );
    const year = scoreFor('year', '2026-02-10', [atmung], [done('2026-01-05', 20), bad('2026-02-03', 6)], ganzesJahr);
    expect(year.categories[0].value).toBe(14);
  });

  it('eine Abzugs-Kategorie (Altbestand) bleibt Abzug, auch ohne Kennzeichen am Habit', () => {
    const score = scoreFor('day', MO, [atmung, zucker], [done(MO, 10, 'zucker')]);
    expect(score.categories.find((c) => c.categoryId === 'zucker')?.value).toBe(-10);
  });

  it('liefert 0 statt -0, wenn sich Gewinn und Abzug aufheben', () => {
    const score = scoreFor('day', MO, [atmung], [done(MO, 6), bad(MO, 6)]);
    expect(Object.is(score.categories[0].value, 0)).toBe(true);
    expect(Object.is(score.total, 0)).toBe(true);
  });
});
