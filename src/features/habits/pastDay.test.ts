import { describe, expect, it } from 'vitest';

import { habitsForDay, parseDayParam } from './pastDay';
import type { HabitLog, MyHabit } from './useHabits';

const HEUTE = '2026-10-30';

// Nur die Felder, nach denen habitsForDay fragt.
function habit(id: string, overrides: Partial<MyHabit> = {}): MyHabit {
  return {
    id,
    is_active: true,
    started_on: '2026-10-01',
    archived_at: null,
    ...overrides,
  } as MyHabit;
}

function log(userHabitId: string, date: string): HabitLog {
  return { user_habit_id: userHabitId, log_date: date } as HabitLog;
}

describe('parseDayParam', () => {
  it('nimmt einen vergangenen Tag und heute', () => {
    expect(parseDayParam('2026-10-27', HEUTE)).toBe('2026-10-27');
    expect(parseDayParam(HEUTE, HEUTE)).toBe(HEUTE);
  });

  it('weist Zukunft, Unsinn und Tage, die es nicht gibt, zurueck', () => {
    expect(parseDayParam('2026-10-31', HEUTE)).toBeNull();
    expect(parseDayParam('2026-02-31', HEUTE)).toBeNull();
    expect(parseDayParam('gestern', HEUTE)).toBeNull();
    expect(parseDayParam(undefined, HEUTE)).toBeNull();
  });

  it('nimmt bei doppeltem Parameter den ersten', () => {
    expect(parseDayParam(['2026-10-20', '2026-10-21'], HEUTE)).toBe('2026-10-20');
  });
});

describe('habitsForDay', () => {
  it('zeigt alle heute gewaehlten Habits, auch vor ihrer Aufnahme (nachtragen)', () => {
    const neu = habit('neu', { started_on: HEUTE });
    expect(habitsForDay([neu], [], '2026-10-20')).toEqual([neu]);
  });

  it('zeigt ein herausgenommenes Habit nur fuer die Tage, an denen es gewaehlt war', () => {
    const alt = habit('alt', {
      is_active: false,
      started_on: '2026-10-10',
      archived_at: '2026-10-20T09:00:00Z',
    });
    expect(habitsForDay([alt], [], '2026-10-15')).toEqual([alt]);
    expect(habitsForDay([alt], [], '2026-10-25')).toEqual([]);
    expect(habitsForDay([alt], [], '2026-10-05')).toEqual([]);
  });

  it('zeigt ein herausgenommenes Habit, wenn es an dem Tag einen Eintrag hat', () => {
    const alt = habit('alt', { is_active: false, started_on: '2026-10-10', archived_at: '2026-10-12T09:00:00Z' });
    expect(habitsForDay([alt], [log('alt', '2026-10-25')], '2026-10-25')).toEqual([alt]);
    expect(habitsForDay([alt], [log('alt', '2026-10-24')], '2026-10-25')).toEqual([]);
  });
});
