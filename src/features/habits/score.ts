// Der Habit Score Tracker - die Rechnung (SAD §3.14).
//
// Gespeichert wird kein Score, nur die Eintraege. Diese Funktionen rechnen
// ihn daraus, jedes Mal. Ein gespeicherter Score waere ein zweiter Wert, der
// neben den Eintraegen herlaeuft und nach dem ersten nachgetragenen Tag
// nicht mehr stimmt.
//
// DIE REGEL IN DREI STUFEN
// ------------------------
//   1. Kategorie und Tag: Punkte der erledigten Habits, gedeckelt auf das
//      Tageslimit der Kategorie. Negative Kategorien ziehen ab, ebenso
//      gedeckelt.
//   2. Kategorie und Woche/Monat: Summe der gedeckelten Tage, gedeckelt auf
//      das Wochen- bzw. Monatslimit.
//   3. Gesamt: Summe aller Kategorien, begrenzt auf [-P, +P]. P ist die
//      Summe der Limits aller POSITIVEN Kategorien im selben Zeitraum. Der
//      Score darf also ins Minus, aber nie weiter, als das positive Maximum
//      reicht (Entscheidung 25.10.2026).
//
// Gerechnet wird mit Betraegen und erst am Ende mit Vorzeichen: so gilt
// dieselbe Deckelung fuer Gewinn und Abzug, ohne zwei Codepfade.
//
// Selbst pruefen (CLAUDE.md §Aufgabenteilung): ein Fehler hier faellt nicht
// auf, er verfaelscht still den Score.

import { monthDays, weekDays, type IsoDate } from '@/features/habits/dates';

export type ScorePeriod = 'day' | 'week' | 'month';

export type ScoreCategory = {
  id: string;
  isNegative: boolean;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
};

/** Ein erledigtes Habit an einem Tag. */
export type ScoreEntry = {
  categoryId: string;
  points: number;
  date: IsoDate;
};

export type CategoryScore = {
  categoryId: string;
  /** Mit Vorzeichen: negativ bei Abzugs-Kategorien. */
  value: number;
  /** Das Limit dieses Zeitraums, immer positiv. */
  max: number;
  isNegative: boolean;
};

export type PeriodScore = {
  period: ScorePeriod;
  categories: CategoryScore[];
  total: number;
  /** P: das erreichbare Maximum - und zugleich die Untergrenze -P. */
  maxTotal: number;
};

function limitFor(category: ScoreCategory, period: ScorePeriod): number {
  if (period === 'day') return category.maxPerDay;
  if (period === 'week') return category.maxPerWeek;
  return category.maxPerMonth;
}

function daysOf(period: ScorePeriod, anchor: IsoDate): IsoDate[] {
  if (period === 'day') return [anchor];
  if (period === 'week') return weekDays(anchor);
  return monthDays(anchor);
}

/**
 * Punkte je Kategorie und Tag als Betrag, schon auf das Tageslimit gedeckelt.
 * Schluessel: `${categoryId}|${date}`.
 */
function cappedDailyAmounts(
  entries: ScoreEntry[],
  byId: Map<string, ScoreCategory>,
): Map<string, number> {
  const raw = new Map<string, number>();
  for (const entry of entries) {
    // Eintraege einer unbekannten Kategorie (zurueckgezogen, nicht
    // veroeffentlicht) zaehlen nicht - sonst stuende ein Betrag ohne Limit da.
    if (!byId.has(entry.categoryId)) continue;
    // Punkte sind laut Datenbank nie negativ (0021, check points >= 0). Wer
    // hier trotzdem etwas Negatives hineinreicht, soll keinen Abzug in einer
    // positiven Kategorie erzeugen.
    const points = Math.max(0, entry.points);
    const key = `${entry.categoryId}|${entry.date}`;
    raw.set(key, (raw.get(key) ?? 0) + points);
  }

  const capped = new Map<string, number>();
  for (const [key, sum] of raw) {
    const category = byId.get(key.split('|')[0])!;
    capped.set(key, Math.min(sum, category.maxPerDay));
  }
  return capped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreFor(
  period: ScorePeriod,
  anchor: IsoDate,
  categories: ScoreCategory[],
  entries: ScoreEntry[],
): PeriodScore {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const daily = cappedDailyAmounts(entries, byId);
  const days = daysOf(period, anchor);

  const result: CategoryScore[] = categories.map((category) => {
    const sum = days.reduce((acc, day) => acc + (daily.get(`${category.id}|${day}`) ?? 0), 0);
    const max = limitFor(category, period);
    const amount = Math.min(sum, max);
    return {
      categoryId: category.id,
      // `|| 0` faengt die -0 ab, die bei einer leeren negativen Kategorie
      // entstuende - in Tests und in der Anzeige ein unnoetiges Raetsel.
      value: (category.isNegative ? -amount : amount) || 0,
      max,
      isNegative: category.isNegative,
    };
  });

  const maxTotal = categories
    .filter((c) => !c.isNegative)
    .reduce((acc, c) => acc + limitFor(c, period), 0);

  const sum = result.reduce((acc, c) => acc + c.value, 0);

  return {
    period,
    categories: result,
    total: clamp(sum, -maxTotal, maxTotal) || 0,
    maxTotal,
  };
}
