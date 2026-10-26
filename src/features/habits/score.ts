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
//      Tageslimit der Kategorie. Negative Habits ziehen ab - ihre Summe wird
//      GETRENNT auf dasselbe Tageslimit gedeckelt (Entscheidung 26.10.2026).
//   2. Kategorie und Woche/Monat: Summe der gedeckelten Tage, gedeckelt auf
//      das Wochen- bzw. Monatslimit - wieder Gewinn und Abzug je fuer sich.
//      Der Wert der Kategorie ist Gewinn minus Abzug, liegt also zwischen
//      -Limit und +Limit.
//   3. Gesamt: Summe aller Kategorien, begrenzt auf [-P, +P]. P ist die
//      Summe der Limits aller POSITIVEN Kategorien im selben Zeitraum. Der
//      Score darf also ins Minus, aber nie weiter, als das positive Maximum
//      reicht (Entscheidung 25.10.2026).
//
// DAS VORZEICHEN HAENGT AM HABIT (seit 26.10.2026, Migration 0028)
// ----------------------------------------------------------------
// Vorher hing es an der Kategorie (0021), und ein Abzug brauchte eine eigene
// Kategorie. Jetzt traegt jede Kategorie Gewinn und Abzug zugleich: "Feste
// Schlafenszeit" und "Koffein am Abend" stehen beide unter Schlaf. Eine
// Kategorie mit is_negative gibt es weiter (alte Daten); dort zaehlt jedes
// Habit als Abzug, und sie traegt nichts zum Maximum P bei.
//
// Getrennt gedeckelt, nicht verrechnet: wer an einem Tag 30 Punkte sammelt
// und 10 verliert, soll nicht 20 behalten, nur weil das Limit 20 ist - der
// Abzug wuerde sonst im Ueberschuss verschwinden. So zaehlen 20 - 10 = 10.
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
  /** Das Habit zieht ab statt zu bringen (habit_templates.is_negative). */
  isNegative?: boolean;
  date: IsoDate;
};

export type CategoryScore = {
  categoryId: string;
  /** Mit Vorzeichen: negativ bei Abzugs-Kategorien. */
  value: number;
  /** Das Limit dieses Zeitraums, immer positiv. */
  max: number;
  /** Die ganze Kategorie zieht ab (Altbestand) - nicht: der Wert ist negativ. */
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

type Amounts = { gain: number; loss: number };

/**
 * Punkte je Kategorie und Tag als Betraege, Gewinn und Abzug je fuer sich
 * schon auf das Tageslimit gedeckelt. Schluessel: `${categoryId}|${date}`.
 */
function cappedDailyAmounts(
  entries: ScoreEntry[],
  byId: Map<string, ScoreCategory>,
): Map<string, Amounts> {
  const raw = new Map<string, Amounts>();
  for (const entry of entries) {
    // Eintraege einer unbekannten Kategorie (zurueckgezogen, nicht
    // veroeffentlicht) zaehlen nicht - sonst stuende ein Betrag ohne Limit da.
    const category = byId.get(entry.categoryId);
    if (!category) continue;
    // Punkte sind laut Datenbank nie negativ (0021, check points >= 0), das
    // Vorzeichen steht daneben. Wer hier trotzdem etwas Negatives
    // hineinreicht, soll damit nicht die Richtung umdrehen.
    const points = Math.max(0, entry.points);
    const key = `${entry.categoryId}|${entry.date}`;
    const sums = raw.get(key) ?? { gain: 0, loss: 0 };
    if (entry.isNegative || category.isNegative) sums.loss += points;
    else sums.gain += points;
    raw.set(key, sums);
  }

  const capped = new Map<string, Amounts>();
  for (const [key, sums] of raw) {
    const category = byId.get(key.split('|')[0])!;
    capped.set(key, {
      gain: Math.min(sums.gain, category.maxPerDay),
      loss: Math.min(sums.loss, category.maxPerDay),
    });
  }
  return capped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function net(amounts: Amounts): number {
  return amounts.gain - amounts.loss;
}

/** Gewinn und Abzug je fuer sich auf `limit` gedeckelt. */
function cap(amounts: Amounts, limit: number): Amounts {
  return { gain: Math.min(amounts.gain, limit), loss: Math.min(amounts.loss, limit) };
}

function add(a: Amounts, b: Amounts): Amounts {
  return { gain: a.gain + b.gain, loss: a.loss + b.loss };
}

const ZERO: Amounts = { gain: 0, loss: 0 };

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
    days.reduce((acc, day) => add(acc, daily.get(`${categoryId}|${day}`) ?? ZERO), ZERO);

  let result: CategoryScore[];

  if (period === 'year') {
    const months = monthsUpTo(anchor);
    const activeIn = months.map((m) => isActive(monthKey(m)));
    result = categories.flatMap((category) => {
      const activeMonths = months.filter((_, i) => activeIn[i](category.id));
      if (activeMonths.length === 0) return [];
      const amounts = activeMonths.reduce(
        (acc, m) => add(acc, cap(sumDays(category.id, monthDays(m)), category.maxPerMonth)),
        ZERO,
      );
      const max = activeMonths.length * category.maxPerMonth;
      return [{ categoryId: category.id, value: net(cap(amounts, max)), max, isNegative: category.isNegative }];
    });
  } else {
    const activeNow = isActive(monthKey(anchor));
    const days = daysOf(period, anchor);
    result = categories
      .filter((category) => activeNow(category.id))
      .map((category) => {
        const max = limitFor(category, period);
        const amounts = cap(sumDays(category.id, days), max);
        return { categoryId: category.id, value: net(amounts), max, isNegative: category.isNegative };
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
