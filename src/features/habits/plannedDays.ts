// Welche Habits stehen an einem Tag im Tagebuch (Migration 0049) - rein, ohne
// React und Netz.
//
// Ein Habit mit planned_days_only, das in einer Challenge steckt, erscheint nur
// an seinen Terminen: Im Uebungsweg CO2-Toleranz sind sechs Sessions gewaehlt,
// dran ist je Tag aber nur je eine fuer morgens und abends.

import type { IsoDate } from './dates';
import type { HabitLog, MyHabit } from './useHabits';

export type HabitSlot = {
  userHabitId: string;
  startsOn: IsoDate;
  dueOn: IsoDate;
  /** Die Challenge laeuft noch: nicht abgebrochen, nicht geloescht. */
  running: boolean;
};

/**
 * Sichtbar bleibt ein Habit, wenn es den Schalter nicht traegt, wenn es nie
 * geplant war (von Hand gewaehlt), wenn es an dem Tag einen laufenden Termin
 * hat oder wenn es an dem Tag einen Eintrag gibt. Sonst liesse sich ein
 * Eintrag von damals nicht mehr korrigieren.
 */
export function habitsPlannedOn(
  habits: MyHabit[],
  slots: HabitSlot[],
  logs: Pick<HabitLog, 'user_habit_id' | 'log_date'>[],
  date: IsoDate,
): MyHabit[] {
  const logged = new Set(logs.filter((l) => l.log_date === date).map((l) => l.user_habit_id));

  return habits.filter((habit) => {
    if (!habit.habit_templates.planned_days_only || logged.has(habit.id)) return true;
    const own = slots.filter((slot) => slot.userHabitId === habit.id);
    if (own.length === 0) return true;
    return own.some((slot) => slot.running && slot.startsOn <= date && date <= slot.dueOn);
  });
}
