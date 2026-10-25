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
// NUR AKTIVE KATEGORIEN (Entscheidung 25.10.2026, zweite Runde)
// -------------------------------------------------------------
// Es gibt sieben Kategorien, aber kaum jemand fuehrt alle. In Score und
// Maximum zaehlen deshalb nur Kategorien, die im MONAT des Zeitraums aktiv
// verwendet wurden - ein Habit aus ihr war gewaehlt oder es gibt einen
// Eintrag (activeCategoriesByMonth). Tag und Woche richten sich nach dem
// Monat ihres Ankertags.
//
// DAS JAHR
// --------
// Je Kategorie die Summe ihrer gedeckelten Monate von Jaenner bis zum Monat
// des Ankers; ihr Maximum ist das Monatslimit mal die Zahl der Monate, in
// denen sie aktiv war. Ein eigenes Jahreslimit gibt es nicht - es ergibt
// sich aus den Monaten.
//
// Gerechnet wird mit Betraegen und erst am Ende mit Vorzeichen: so gilt
// dieselbe Deckelung fuer Gewinn und Abzug, ohne zwei Codepfade.
//
// Selbst pruefen (CLAUDE.md §Aufgabenteilung): ein Fehler hier faellt nicht
// auf, er verfaelscht still den Score.

import { monthDays, monthKey, weekDays, type IsoDate } from '@/features/habits/dates';

export type ScorePeriod = 'day' | 'week' | 'month' | 'year';

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

/** Welche Kategorien in einem Monat (YYYY-MM) aktiv verwendet wurden. */
export type ActiveCategories = (month: string) => ReadonlySet<string>;

/** Ein gewaehltes Habit, soweit es fuer "aktiv" zaehlt. */
export type ActiveHabit = {
  categoryId: string;
  startedOn: IsoDate;
  /** Tag des Herausnehmens, null = noch gewaehlt. */
  archivedOn: IsoDate | null;
};

/**
 * Aktiv in einem Monat ist eine Kategorie, wenn in diesem Monat ein Habit aus
 * ihr gewaehlt war (auch nur an einem Tag) oder es einen Eintrag in ihr gibt.
 * Der Eintrag zaehlt mit, damit ein spaeter herausgenommenes Habit seinen
 * Monat nicht nachtraeglich aus der Rechnung nimmt.
 */
export function activeCategoriesByMonth(habits: ActiveHabit[], entries: ScoreEntry[]): ActiveCategories {
  const byMonth = new Map<string, Set<string>>();
  for (const entry of entries) {
    const month = monthKey(entry.date);
    if (!byMonth.has(month)) byMonth.set(month, new Set());
    byMonth.get(month)!.add(entry.categoryId);
  }

  return (month: string) => {
    const set = new Set(byMonth.get(month) ?? []);
    const first = `${month}-01`;
    const last = monthDays(first).at(-1)!;
    for (const habit of habits) {
      const chosenBeforeEnd = habit.startedOn <= last;
      const stillChosenAtStart = habit.archivedOn === null || habit.archivedOn >= first;
      if (chosenBeforeEnd && stillChosenAtStart) set.add(habit.categoryId);
    }
    return set;
  };
}

function limitFor(category: ScoreCategory, period: Exclude<ScorePeriod, 'year'>): number {
  if (period === 'day') return category.maxPerDay;
  if (period === 'week') return category.maxPerWeek;
  return category.maxPerMonth;
}

function daysOf(period: Exclude<ScorePeriod, 'year'>, anchor: IsoDate): IsoDate[] {
  if (period === 'day') return [anchor];
  if (period === 'week') return weekDays(anchor);
  return monthDays(anchor);
}

/** Erste Tage der Monate von Jaenner bis zum Monat des Ankers. */
function monthsUpTo(anchor: IsoDate): IsoDate[] {
  const [year, month] = anchor.split('-');
  return Array.from({ length: Number(month) }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`);
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

function signed(category: ScoreCategory, amount: number): number {
  // `|| 0` faengt die -0 ab, die bei einer leeren negativen Kategorie
  // entstuende - in Tests und in der Anzeige ein unnoetiges Raetsel.
  return (category.isNegative ? -amount : amount) || 0;
}

/**
 * Der Score eines Zeitraums. Ohne `active` zaehlen alle Kategorien - so
 * rechnen die Tests der einzelnen Stufen; die Oberflaeche reicht immer
 * activeCategoriesByMonth() herein.
 */
export function scoreFor(
  period: ScorePeriod,
  anchor: IsoDate,
  categories: ScoreCategory[],
  entries: ScoreEntry[],
  active?: ActiveCategories,
): PeriodScore {
  const isActive = (month: string): ((categoryId: string) => boolean) => {
    if (!active) return () => true;
    const set = active(month);
    return (categoryId) => set.has(categoryId);
  };
  const byId = new Map(categories.map((c) => [c.id, c]));
  const daily = cappedDailyAmounts(entries, byId);
  const sumDays = (categoryId: string, days: IsoDate[]) =>
    days.reduce((acc, day) => acc + (daily.get(`${categoryId}|${day}`) ?? 0), 0);

  let result: CategoryScore[];

  if (period === 'year') {
    const months = monthsUpTo(anchor);
    const activeIn = months.map((m) => isActive(monthKey(m)));
    result = categories.flatMap((category) => {
      const activeMonths = months.filter((_, i) => activeIn[i](category.id));
      if (activeMonths.length === 0) return [];
      const amount = activeMonths.reduce(
        (acc, m) => acc + Math.min(sumDays(category.id, monthDays(m)), category.maxPerMonth),
        0,
      );
      const max = activeMonths.length * category.maxPerMonth;
      return [{ categoryId: category.id, value: signed(category, Math.min(amount, max)), max, isNegative: category.isNegative }];
    });
  } else {
    const activeNow = isActive(monthKey(anchor));
    const days = daysOf(period, anchor);
    result = categories
      .filter((category) => activeNow(category.id))
      .map((category) => {
        const max = limitFor(category, period);
        const amount = Math.min(sumDays(category.id, days), max);
        return { categoryId: category.id, value: signed(category, amount), max, isNegative: category.isNegative };
      });
  }

  const maxTotal = result.filter((c) => !c.isNegative).reduce((acc, c) => acc + c.max, 0);
  const sum = result.reduce((acc, c) => acc + c.value, 0);

  return {
    period,
    categories: result,
    total: clamp(sum, -maxTotal, maxTotal) || 0,
    maxTotal,
  };
}
