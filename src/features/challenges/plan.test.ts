import { describe, expect, it } from 'vitest';

import type { ValueRule } from '@/features/habits/valuePoints';

import { expandPlan, parsePlan, parseTemplatePlan, phaseOf, progressOf, slotStatus, templatePlanToPlan } from './plan';

// 2. November 2026 ist ein Montag.
const START = '2026-11-02';
const END = '2026-11-15';

const done: ValueRule = {
  tracking_type: 'done',
  points: 5,
  is_negative: false,
  higher_is_better: true,
  points_from: null,
  penalty_from: null,
  penalty_points: null,
};
const schlaf: ValueRule = {
  ...done,
  tracking_type: 'number',
  points_from: 7,
  penalty_from: 6,
  penalty_points: 5,
};

describe('expandPlan', () => {
  it('jeden Tag', () => {
    const slots = expandPlan({ daily: true }, START, END);
    expect(slots).toHaveLength(14);
    expect(slots[0]).toEqual({ startsOn: START, dueOn: START });
    expect(slots.at(-1)).toEqual({ startsOn: END, dueOn: END });
  });

  it('Muskeltraining Mo, Mi, Fr', () => {
    const slots = expandPlan({ weekdays: [1, 3, 5] }, START, END);
    expect(slots.map((s) => s.dueOn)).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-06',
      '2026-11-09',
      '2026-11-11',
      '2026-11-13',
    ]);
  });

  it('bestimmte Daten, nur innerhalb der Challenge', () => {
    const slots = expandPlan({ dates: ['2026-11-01', '2026-11-05', '2026-11-20'] }, START, END);
    expect(slots.map((s) => s.dueOn)).toEqual(['2026-11-05']);
  });

  it('3 Tage Fasten einmal: ein Termin, abgehakt am Ende', () => {
    expect(expandPlan({ blocks: [{ start: '2026-11-09', length: 3 }] }, START, END)).toEqual([
      { startsOn: '2026-11-09', dueOn: '2026-11-11' },
    ]);
  });

  it('kombiniert: Wochentage plus Block, der Block deckt seine Tage ab', () => {
    const slots = expandPlan({ weekdays: [1, 3], blocks: [{ start: '2026-11-09', length: 3 }] }, START, END);
    expect(slots).toEqual([
      { startsOn: '2026-11-02', dueOn: '2026-11-02' },
      { startsOn: '2026-11-04', dueOn: '2026-11-04' },
      { startsOn: '2026-11-09', dueOn: '2026-11-11' },
    ]);
  });

  it('ein Block ueber das Ende hinaus endet am letzten Tag, ueberlappende fallen weg', () => {
    const slots = expandPlan(
      {
        blocks: [
          { start: '2026-11-14', length: 3 },
          { start: '2026-11-13', length: 2 },
          { start: '2026-11-03', length: 2 },
        ],
      },
      START,
      END,
    );
    expect(slots).toEqual([
      { startsOn: '2026-11-03', dueOn: '2026-11-04' },
      { startsOn: '2026-11-14', dueOn: '2026-11-15' },
    ]);
  });

  it('leerer Plan oder verkehrter Zeitraum: keine Termine', () => {
    expect(expandPlan({}, START, END)).toEqual([]);
    expect(expandPlan({ daily: true }, END, START)).toEqual([]);
  });
});

describe('parsePlan', () => {
  it('nimmt nur, was passt', () => {
    expect(
      parsePlan({
        daily: 'ja',
        weekdays: [3, 1, 9, 1, 'x'],
        dates: ['2026-11-05', 'gestern'],
        blocks: [
          { start: '2026-11-09', length: 3 },
          { start: '2026-11-10', length: 0 },
        ],
      }),
    ).toEqual({
      weekdays: [1, 3],
      dates: ['2026-11-05'],
      blocks: [{ start: '2026-11-09', length: 3 }],
    });
    expect(parsePlan(null)).toEqual({});
  });
});

describe('Vorlage auf einen Starttag legen', () => {
  it('rechnet Tage nach dem Start in Daten um', () => {
    const plan = templatePlanToPlan(
      parseTemplatePlan({
        weekdays: [1],
        days: [0, 7],
        blocks: [{ start: 10, length: 3 }],
      }),
      START,
    );
    expect(plan).toEqual({
      weekdays: [1],
      dates: ['2026-11-02', '2026-11-09'],
      blocks: [{ start: '2026-11-12', length: 3 }],
    });
  });
});

describe('slotStatus und Fortschritt', () => {
  const today = '2026-11-10';

  it('ein Tag: erfuellt mit Eintrag am Tag, sonst verpasst oder offen', () => {
    expect(
      slotStatus({ startsOn: '2026-11-09', dueOn: '2026-11-09' }, [{ date: '2026-11-09', value: 1 }], done, today),
    ).toBe('done');
    expect(
      slotStatus({ startsOn: '2026-11-09', dueOn: '2026-11-09' }, [{ date: '2026-11-08', value: 1 }], done, today),
    ).toBe('missed');
    expect(slotStatus({ startsOn: '2026-11-10', dueOn: '2026-11-10' }, [], done, today)).toBe('open');
  });

  it('ein Block zaehlt mit einem Eintrag irgendwo in seinem Zeitraum', () => {
    const block = { startsOn: '2026-11-07', dueOn: '2026-11-09' };
    expect(slotStatus(block, [{ date: '2026-11-09', value: 1 }], done, today)).toBe('done');
    expect(slotStatus(block, [], done, today)).toBe('missed');
  });

  it('ein Zahlen-Habit mit Grenze erst ab der Plus-Grenze', () => {
    const slot = { startsOn: '2026-11-09', dueOn: '2026-11-09' };
    expect(slotStatus(slot, [{ date: '2026-11-09', value: 6.5 }], schlaf, today)).toBe('missed');
    expect(slotStatus(slot, [{ date: '2026-11-09', value: 7.5 }], schlaf, today)).toBe('done');
  });

  it('Fortschritt = erfuellt von geplant', () => {
    expect(progressOf(['done', 'done', 'missed', 'open'])).toEqual({
      planned: 4,
      done: 2,
      missed: 1,
      open: 1,
      percent: 50,
    });
    expect(progressOf([])).toEqual({
      planned: 0,
      done: 0,
      missed: 0,
      open: 0,
      percent: 0,
    });
  });
});

describe('phaseOf', () => {
  const c = { starts_on: START, ends_on: END, cancelled_at: null };
  it.each([
    ['2026-11-01', 'upcoming'],
    [START, 'running'],
    [END, 'running'],
    ['2026-11-16', 'finished'],
  ])('%s', (today, phase) => {
    expect(phaseOf(c, today)).toBe(phase);
  });
  it('abgebrochen geht vor', () => {
    expect(phaseOf({ ...c, cancelled_at: '2026-11-05T10:00:00Z' }, '2026-11-06')).toBe('cancelled');
  });
});
