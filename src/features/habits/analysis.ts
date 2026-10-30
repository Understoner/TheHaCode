// Auswertungen je Kategorie und je Habit fuer die Auswertungsseite des
// Tagebuchs (30.10.2026). Rein, ohne React und Netz - wie stats.ts.
//
// Bewusst ohne Bewertung (SAD §5.7): Die Funktionen zaehlen, was eingetragen
// ist, und vergleichen nur mit dem eigenen Zeitraum davor. Keine Normwerte,
// kein "gut" oder "schlecht" - die Oberflaeche zeigt Zahlen und Richtung.
//
// Ein Eintrag ist hier ein erledigtes Habit an einem Tag, egal welcher Art
// (Haken, Zahl, Text): habit_logs kennt je Habit und Tag hoechstens eine
// Zeile (0021).

import { addDays, weekdayIndex, type IsoDate } from './dates';

export type AnalysisHabit = {
  id: string;
  categoryId: string;
  /** Zieht ab (Habit oder - Altbestand - ganze Kategorie, siehe score.ts). */
  isNegative: boolean;
  isActive: boolean;
  startedOn: IsoDate;
};

export type AnalysisLog = { habitId: string; date: IsoDate };

/** Die `days` Tage bis einschliesslich `end`. */
function windowStart(end: IsoDate, days: number): IsoDate {
  return addDays(end, -(days - 1));
}

// ---------------------------------------------------------------------------
// Kategorien im Vergleich: dieser Zeitraum gegen den davor
// ---------------------------------------------------------------------------

export type CategoryPeriod = {
  /** Erledigte Habits, die Punkte bringen. */
  positive: number;
  /** Erledigte Habits, die abziehen. */
  negative: number;
  /** Tage mit mindestens einem positiven Eintrag in der Kategorie. */
  activeDays: number;
};

export type CategoryComparison = {
  categoryId: string;
  current: CategoryPeriod;
  previous: CategoryPeriod;
};

/**
 * Je Kategorie die letzten `days` Tage (bis heute) gegen die `days` Tage
 * davor. Kategorien ohne einen einzigen Eintrag in beiden Zeitraeumen fallen
 * weg - sie sagen nichts.
 */
export function categoryComparison(
  habits: AnalysisHabit[],
  logs: AnalysisLog[],
  today: IsoDate,
  days = 28,
): CategoryComparison[] {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const currentStart = windowStart(today, days);
  const previousStart = addDays(currentStart, -days);

  const empty = (): CategoryPeriod & { days: Set<IsoDate> } => ({
    positive: 0,
    negative: 0,
    activeDays: 0,
    days: new Set(),
  });
  const result = new Map<string, { current: ReturnType<typeof empty>; previous: ReturnType<typeof empty> }>();

  for (const log of logs) {
    const habit = byId.get(log.habitId);
    if (!habit || log.date > today || log.date < previousStart) continue;
    const entry = result.get(habit.categoryId) ?? { current: empty(), previous: empty() };
    const period = log.date >= currentStart ? entry.current : entry.previous;
    if (habit.isNegative) period.negative += 1;
    else {
      period.positive += 1;
      period.days.add(log.date);
    }
    result.set(habit.categoryId, entry);
  }

  const strip = ({ positive, negative, days: d }: ReturnType<typeof empty>): CategoryPeriod => ({
    positive,
    negative,
    activeDays: d.size,
  });
  return [...result.entries()].map(([categoryId, { current, previous }]) => ({
    categoryId,
    current: strip(current),
    previous: strip(previous),
  }));
}

// ---------------------------------------------------------------------------
// Wochentage: an welchen Tagen klappt es
// ---------------------------------------------------------------------------

/**
 * Positive Eintraege je Wochentag (0 = Montag) in den letzten `weeks` vollen
 * Wochen bis heute. Jeder Wochentag kommt im Zeitraum gleich oft vor, die
 * Zahlen sind also direkt vergleichbar.
 */
export function weekdayPattern(
  habits: AnalysisHabit[],
  logs: AnalysisLog[],
  today: IsoDate,
  weeks = 8,
): number[] {
  const positive = new Set(habits.filter((h) => !h.isNegative).map((h) => h.id));
  const start = windowStart(today, weeks * 7);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const log of logs) {
    if (!positive.has(log.habitId) || log.date < start || log.date > today) continue;
    counts[weekdayIndex(log.date)] += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Je Habit: wie regelmaessig, wie lange am Stueck, wie lange frei
// ---------------------------------------------------------------------------

export type HabitConsistency = {
  habitId: string;
  /** Tage im Zeitraum mit Eintrag. */
  doneDays: number;
  /** Tage im Zeitraum - kuerzer, wenn das Habit spaeter dazukam. */
  windowDays: number;
  /**
   * Tage am Stueck bis heute. Ist heute noch nichts eingetragen, zaehlt die
   * Serie bis gestern - wie in streakWithGrace: der Tag ist nicht vorbei.
   */
  currentStreak: number;
  /** Laengste Serie im Zeitraum. */
  longestStreak: number;
  /** Tage seit dem letzten Eintrag; null, wenn es im Zeitraum keinen gibt. */
  daysSinceLast: number | null;
};

/**
 * Fuer die gewaehlten Habits die letzten `days` Tage. Bei Habits, die
 * abziehen, liest die Oberflaeche dieselben Zahlen andersherum: "frei seit"
 * statt "in Folge".
 */
export function habitConsistency(
  habits: AnalysisHabit[],
  logs: AnalysisLog[],
  today: IsoDate,
  days = 28,
): HabitConsistency[] {
  const start = windowStart(today, days);
  const datesByHabit = new Map<string, Set<IsoDate>>();
  for (const log of logs) {
    if (log.date > today) continue;
    const set = datesByHabit.get(log.habitId) ?? new Set<IsoDate>();
    set.add(log.date);
    datesByHabit.set(log.habitId, set);
  }

  return habits
    .filter((h) => h.isActive)
    .map((habit) => {
      const dates = datesByHabit.get(habit.id) ?? new Set<IsoDate>();
      // Wer ein Habit erst vor fuenf Tagen gewaehlt hat, soll nicht "2 von 28"
      // lesen. Nachgetragene Tage vor der Aufnahme zaehlen trotzdem mit.
      const earliestLog = [...dates].sort()[0];
      const firstDay =
        earliestLog !== undefined && earliestLog < habit.startedOn ? earliestLog : habit.startedOn;
      const from = firstDay > start ? firstDay : start;

      let doneDays = 0;
      let windowDays = 0;
      let run = 0;
      let longestStreak = 0;
      for (let day = from; day <= today; day = addDays(day, 1)) {
        windowDays += 1;
        if (dates.has(day)) {
          doneDays += 1;
          run += 1;
          longestStreak = Math.max(longestStreak, run);
        } else {
          run = 0;
        }
      }

      let currentStreak = 0;
      for (let day = dates.has(today) ? today : addDays(today, -1); dates.has(day); day = addDays(day, -1)) {
        currentStreak += 1;
      }

      let daysSinceLast: number | null = null;
      for (let day = today, n = 0; day >= start; day = addDays(day, -1), n += 1) {
        if (dates.has(day)) {
          daysSinceLast = n;
          break;
        }
      }

      return { habitId: habit.id, doneDays, windowDays, currentStreak, longestStreak, daysSinceLast };
    });
}
