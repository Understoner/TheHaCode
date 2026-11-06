import { describe, expect, it } from 'vitest';

import { habitsPlannedOn, type HabitSlot } from './plannedDays';
import type { MyHabit } from './useHabits';

const habit = (id: string, plannedDaysOnly = true) =>
  ({ id, habit_templates: { planned_days_only: plannedDaysOnly } }) as unknown as MyHabit;
const slot = (userHabitId: string, startsOn: string, dueOn = startsOn, running = true): HabitSlot => ({
  userHabitId,
  startsOn,
  dueOn,
  running,
});
const ids = (list: MyHabit[]) => list.map((h) => h.id);

describe('habitsPlannedOn', () => {
  const week1 = slot('anfaenger', '2026-11-06');
  const week2 = slot('fortgeschritten', '2026-11-13');

  it('zeigt nur die Session, die an dem Tag dran ist', () => {
    const habits = [habit('anfaenger'), habit('fortgeschritten')];
    expect(ids(habitsPlannedOn(habits, [week1, week2], [], '2026-11-06'))).toEqual(['anfaenger']);
    expect(ids(habitsPlannedOn(habits, [week1, week2], [], '2026-11-13'))).toEqual(['fortgeschritten']);
  });

  it('laesst Habits ohne Schalter jeden Tag stehen', () => {
    expect(ids(habitsPlannedOn([habit('walk', false)], [week1], [], '2026-11-20'))).toEqual(['walk']);
  });

  it('zeigt ein von Hand gewaehltes Habit ohne Termine jeden Tag', () => {
    expect(ids(habitsPlannedOn([habit('anfaenger')], [], [], '2026-11-20'))).toEqual(['anfaenger']);
  });

  it('versteckt es nach dem Ende und bei abgebrochener Challenge', () => {
    expect(habitsPlannedOn([habit('anfaenger')], [week1], [], '2026-11-07')).toEqual([]);
    const cancelled = slot('anfaenger', '2026-11-06', '2026-11-06', false);
    expect(habitsPlannedOn([habit('anfaenger')], [cancelled], [], '2026-11-06')).toEqual([]);
  });

  it('laesst einen Eintrag auch ausserhalb des Plans sichtbar', () => {
    const logs = [{ user_habit_id: 'anfaenger', log_date: '2026-11-07' }];
    expect(ids(habitsPlannedOn([habit('anfaenger')], [week1], logs, '2026-11-07'))).toEqual(['anfaenger']);
  });

  it('kennt mehrtaegige Termine', () => {
    const block = slot('anfaenger', '2026-11-06', '2026-11-08');
    expect(ids(habitsPlannedOn([habit('anfaenger')], [block], [], '2026-11-07'))).toEqual(['anfaenger']);
  });
});
