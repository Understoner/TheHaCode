// Auswertungen des Atem-Tagebuchs (SAD §3.14). Alles rein, ohne Netz -
// damit es sich mit Vitest pruefen laesst (SAD §8: Streaks sind Pflicht).

import {
  addDays,
  monthDays,
  weekDays,
  weekStart,
  type IsoDate,
} from '@/features/habits/dates';

// ---------------------------------------------------------------------------
// Konstanz in dieser Woche: "x von 7 Tagen"
// ---------------------------------------------------------------------------

/**
 * An wie vielen Tagen der laufenden Woche mindestens ein Habit erledigt ist.
 * Gezaehlt wird bis heute; die Tage danach koennen noch kommen.
 */
export function daysDoneThisWeek(doneDays: ReadonlySet<IsoDate>, today: IsoDate): number {
  return weekDays(today).filter((day) => day <= today && doneDays.has(day)).length;
}

// ---------------------------------------------------------------------------
// Serie mit Schonfrist
// ---------------------------------------------------------------------------
// Harte Serien sind laut Erfahrung von Habit-Apps der haeufigste Grund
// aufzugeben: ein einziger verpasster Tag macht 40 Tage zu null. Deshalb
// bricht ein freier Tag je Kalenderwoche die Serie nicht. Ein zweiter in
// derselben Woche schon.
//
// Heute zaehlt nicht als verpasst, solange es nicht vorbei ist - wer morgens
// nachsieht, soll nicht lesen, seine Serie sei weg.

export type Streak = {
  /** Tage mit mindestens einem Eintrag innerhalb der Serie. */
  days: number;
  /** Ob in der laufenden Woche der freie Tag schon verbraucht ist. */
  graceUsedThisWeek: boolean;
};

export function streakWithGrace(doneDays: ReadonlySet<IsoDate>, today: IsoDate): Streak {
  if (doneDays.size === 0) return { days: 0, graceUsedThisWeek: false };

  // Weiter zurueck als der frueheste Eintrag gibt es nichts zu zaehlen.
  const earliest = [...doneDays].sort()[0];
  const forgivenWeeks = new Set<IsoDate>();

  let days = 0;
  let day = doneDays.has(today) ? today : addDays(today, -1);

  while (day >= earliest) {
    if (doneDays.has(day)) {
      days += 1;
    } else {
      const week = weekStart(day);
      if (forgivenWeeks.has(week)) break;
      forgivenWeeks.add(week);
    }
    day = addDays(day, -1);
  }

  return { days, graceUsedThisWeek: forgivenWeeks.has(weekStart(today)) };
}

// ---------------------------------------------------------------------------
// Monatskalender
// ---------------------------------------------------------------------------

export type HeatDay = {
  date: IsoDate;
  /** 0 = nichts, 1..4 = Anteil erledigter Habits in Vierteln (aufgerundet). */
  level: 0 | 1 | 2 | 3 | 4;
  done: number;
  isFuture: boolean;
};

/**
 * Jeder Tag des Monats mit seiner Stufe. Die Stufe bemisst sich an der Zahl
 * der Habits, die heute gewaehlt sind: genauer gaebe es die Auswahl je Tag
 * nur, wenn man sie mitspeicherte - fuer ein Farbfeld ist das zu viel.
 */
export function monthHeat(
  anchor: IsoDate,
  doneCountByDay: ReadonlyMap<IsoDate, number>,
  habitCount: number,
  today: IsoDate,
): HeatDay[] {
  return monthDays(anchor).map((date) => heatDay(date, doneCountByDay, habitCount, today));
}

/**
 * Die sieben Tage der Woche, in der `anchor` liegt, Montag zuerst - fuer die
 * Wochenreihe im Tagebuch (30.10.2026), die auch in fruehere Wochen
 * blaettern kann. Dieselben Stufen wie im Monatskalender, damit beide
 * Ansichten dieselbe Farbe fuer denselben Tag zeigen.
 */
export function weekHeat(
  anchor: IsoDate,
  doneCountByDay: ReadonlyMap<IsoDate, number>,
  habitCount: number,
  today: IsoDate = anchor,
): HeatDay[] {
  return weekDays(anchor).map((date) => heatDay(date, doneCountByDay, habitCount, today));
}

function heatDay(
  date: IsoDate,
  doneCountByDay: ReadonlyMap<IsoDate, number>,
  habitCount: number,
  today: IsoDate,
): HeatDay {
  const done = doneCountByDay.get(date) ?? 0;
  let level: HeatDay['level'] = 0;
  if (done > 0) {
    const ratio = habitCount > 0 ? Math.min(1, done / habitCount) : 1;
    level = Math.max(1, Math.ceil(ratio * 4)) as HeatDay['level'];
  }
  return { date, level, done, isFuture: date > today };
}

// ---------------------------------------------------------------------------
// BOLT-Verlauf
// ---------------------------------------------------------------------------

export type Measurement = { date: IsoDate; value: number };

export type TrendPoint = Measurement & {
  /** Schnitt aller Messungen der sieben Tage bis einschliesslich heute. */
  average: number;
};

/**
 * Gleitender 7-Tage-Schnitt. Ueber Kalendertage, nicht ueber die letzten
 * sieben Messungen: wer eine Woche aussetzt, soll keinen Schnitt sehen, der
 * Werte aus dem Vormonat mitschleppt.
 */
export function movingAverage(points: Measurement[], windowDays = 7): TrendPoint[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((point) => {
    const from = addDays(point.date, -(windowDays - 1));
    const window = sorted.filter((p) => p.date >= from && p.date <= point.date);
    const average = window.reduce((sum, p) => sum + p.value, 0) / window.length;
    return { ...point, average: Math.round(average * 10) / 10 };
  });
}

export type TrendSummary = {
  best: number | null;
  first: number | null;
  latest: number | null;
  /** Letzte minus erste Messung. Keine Bewertung, nur die Veraenderung. */
  change: number | null;
};

export function trendSummary(points: Measurement[]): TrendSummary {
  if (points.length === 0) return { best: null, first: null, latest: null, change: null };
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0].value;
  const latest = sorted[sorted.length - 1].value;
  return {
    best: Math.max(...sorted.map((p) => p.value)),
    first,
    latest,
    change: latest - first,
  };
}

// ---------------------------------------------------------------------------
// Atemminuten je Woche
// ---------------------------------------------------------------------------

export type SessionLike = { started_at: string; duration_seconds: number | null };

export type WeekMinutes = { weekStart: IsoDate; minutes: number };

/**
 * Minuten je Woche fuer die letzten `weeks` Wochen, aelteste zuerst. Die
 * Woche einer Session richtet sich nach ihrem Start in Ortszeit.
 */
export function minutesPerWeek(
  sessions: SessionLike[],
  today: IsoDate,
  toLocalDate: (timestamp: string) => IsoDate,
  weeks = 8,
): WeekMinutes[] {
  const current = weekStart(today);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
  const seconds = new Map(starts.map((s) => [s, 0]));

  for (const session of sessions) {
    if (!session.duration_seconds) continue;
    const week = weekStart(toLocalDate(session.started_at));
    if (seconds.has(week)) seconds.set(week, seconds.get(week)! + session.duration_seconds);
  }

  return starts.map((s) => ({ weekStart: s, minutes: Math.round(seconds.get(s)! / 60) }));
}
