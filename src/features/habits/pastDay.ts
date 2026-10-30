// Die Tagesseite fuer einen vergangenen Tag (30.10.2026) - rein, ohne React
// und Netz.

import { toIsoDate, type IsoDate } from './dates';
import type { HabitLog, MyHabit } from './useHabits';

/**
 * Der Tag aus der Adresse, wenn er ein echter Kalendertag und nicht in der
 * Zukunft ist. Sonst null - die Seite zeigt dann einen Hinweis statt einer
 * Liste, in die sich nichts eintragen liesse.
 */
export function parseDayParam(raw: string | string[] | undefined, today: IsoDate): IsoDate | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  // 2026-02-31 waere sonst still der 3. Maerz.
  if (toIsoDate(date) !== value) return null;
  return value > today ? null : value;
}

/**
 * Welche Habits an einem Tag zur Auswahl stehen: alle, die heute gewaehlt
 * sind (wie beim Zurueckblaettern im Tagebuch), dazu die inzwischen
 * herausgenommenen, wenn sie an dem Tag noch gewaehlt waren oder einen
 * Eintrag haben. Sonst verschwaende ein Eintrag von damals aus der Liste und
 * liesse sich nicht mehr korrigieren.
 */
export function habitsForDay(habits: MyHabit[], logs: HabitLog[], date: IsoDate): MyHabit[] {
  const logged = new Set(logs.filter((l) => l.log_date === date).map((l) => l.user_habit_id));

  return habits.filter((h) => {
    if (h.is_active || logged.has(h.id)) return true;
    // Dieselbe Regel wie in DiaryInsights: ohne archived_at zaehlt der Tag
    // der Aufnahme als letzter.
    const archivedOn = h.archived_at ? toIsoDate(new Date(h.archived_at)) : h.started_on;
    return h.started_on <= date && date <= archivedOn;
  });
}
