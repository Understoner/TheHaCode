// Der Score eines Tages fuer den Ring im Tagebuch (02.11.2026, Vorschlag
// "Mondlicht Mobile", nur Testsystem). Rechnet NICHT selbst: dieselbe
// Umwandlung wie DiaryInsights.tsx, dann score.ts - damit Ring und
// Auswertung nie zwei verschiedene Zahlen zeigen.

import { toIsoDate, type IsoDate } from './dates';
import { activeCategoriesByMonth, scoreFor, type ActiveHabit, type ScoreCategory, type ScoreEntry } from './score';
import type { HabitCategory, HabitLog, MyHabit } from './useHabits';
import { pointsForEntry } from './valuePoints';

export function dayScore(
  date: IsoDate,
  habits: MyHabit[],
  categories: HabitCategory[],
  logs: HabitLog[],
): { total: number; maxTotal: number } {
  const byHabit = new Map(habits.map((h) => [h.id, h]));
  const scoreCategories: ScoreCategory[] = categories.map((c) => ({
    id: c.id,
    isNegative: c.is_negative,
    maxPerDay: c.max_per_day,
    maxPerWeek: c.max_per_week,
    maxPerMonth: c.max_per_month,
  }));
  const entries: ScoreEntry[] = logs.flatMap((l) => {
    const habit = byHabit.get(l.user_habit_id);
    if (!habit) return [];
    const { points, isNegative } = pointsForEntry(
      habit.habit_templates,
      l.value_numeric === null ? null : Number(l.value_numeric),
    );
    return [{ categoryId: habit.habit_templates.category_id, points, isNegative, date: l.log_date }];
  });
  const archivedOn = (h: MyHabit) =>
    h.is_active ? null : h.archived_at ? toIsoDate(new Date(h.archived_at)) : h.started_on;
  const activeHabits: ActiveHabit[] = habits.map((h) => ({
    categoryId: h.habit_templates.category_id,
    startedOn: h.started_on,
    archivedOn: archivedOn(h),
  }));
  const score = scoreFor('day', date, scoreCategories, entries, activeCategoriesByMonth(activeHabits, entries));
  return { total: score.total, maxTotal: score.maxTotal };
}
