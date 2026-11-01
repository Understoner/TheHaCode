import { describe, expect, it } from 'vitest';

import { hasValueRule, meetsGoal, pointsForEntry, type ValueRule } from './valuePoints';

const schlaf: ValueRule = {
  tracking_type: 'number',
  points: 8,
  is_negative: false,
  higher_is_better: true,
  points_from: 7,
  penalty_from: 6,
  penalty_points: 8,
};

const bildschirm: ValueRule = {
  tracking_type: 'number',
  points: 5,
  is_negative: false,
  higher_is_better: false,
  points_from: 2,
  penalty_from: 4,
  penalty_points: 3,
};

describe('pointsForEntry - ohne Grenzen wie bisher', () => {
  it('bringt die Punkte fuers Eintragen, egal welcher Wert', () => {
    const bolt: ValueRule = { ...schlaf, points: 10, points_from: null, penalty_from: null, penalty_points: null };
    expect(hasValueRule(bolt)).toBe(false);
    expect(pointsForEntry(bolt, 12)).toEqual({ points: 10, isNegative: false });
    expect(pointsForEntry(bolt, 40)).toEqual({ points: 10, isNegative: false });
  });

  it('laesst das Vorzeichen eines Abzugs-Habits stehen', () => {
    const done: ValueRule = { ...schlaf, tracking_type: 'done', is_negative: true, points: 4 };
    expect(pointsForEntry(done, 1)).toEqual({ points: 4, isNegative: true });
  });

  it('ignoriert Grenzen an einem Abzugs-Habit (die Datenbank verbietet sie ohnehin)', () => {
    expect(pointsForEntry({ ...schlaf, is_negative: true }, 3)).toEqual({ points: 8, isNegative: true });
  });
});

describe('pointsForEntry - Schlafdauer: Minus unter 6, Plus ab 7', () => {
  it.each([
    [5.5, { points: 8, isNegative: true }],
    [5.99, { points: 8, isNegative: true }],
    [6, { points: 0, isNegative: false }],
    [6.5, { points: 0, isNegative: false }],
    [7, { points: 8, isNegative: false }],
    [9, { points: 8, isNegative: false }],
  ])('%s Stunden', (value, expected) => {
    expect(pointsForEntry(schlaf, value)).toEqual(expected);
  });

  it('ohne Wert gibt es nichts', () => {
    expect(pointsForEntry(schlaf, null)).toEqual({ points: 0, isNegative: false });
  });
});

describe('pointsForEntry - weniger ist besser', () => {
  it.each([
    [1, { points: 5, isNegative: false }],
    [2, { points: 5, isNegative: false }],
    [3, { points: 0, isNegative: false }],
    [4, { points: 0, isNegative: false }],
    [4.5, { points: 3, isNegative: true }],
  ])('%s Stunden Bildschirm', (value, expected) => {
    expect(pointsForEntry(bildschirm, value)).toEqual(expected);
  });
});

describe('pointsForEntry - nur eine Grenze', () => {
  it('nur Plus-Grenze: darunter nichts, nie Abzug', () => {
    const rule = { ...schlaf, penalty_from: null, penalty_points: null };
    expect(pointsForEntry(rule, 3)).toEqual({ points: 0, isNegative: false });
    expect(pointsForEntry(rule, 7)).toEqual({ points: 8, isNegative: false });
  });

  it('nur Minus-Grenze: alles darueber bringt die Punkte', () => {
    const rule = { ...schlaf, points_from: null };
    expect(pointsForEntry(rule, 5)).toEqual({ points: 8, isNegative: true });
    expect(pointsForEntry(rule, 6)).toEqual({ points: 8, isNegative: false });
  });

  it('eine fehlende Minuspunktzahl zieht nichts ab', () => {
    expect(pointsForEntry({ ...schlaf, penalty_points: null }, 4)).toEqual({ points: 0, isNegative: true });
  });
});

describe('meetsGoal - fuer Challenges', () => {
  it('mit Grenzen erst in der Plus-Zone', () => {
    expect(meetsGoal(schlaf, 6.5)).toBe(false);
    expect(meetsGoal(schlaf, 7)).toBe(true);
    expect(meetsGoal(schlaf, null)).toBe(false);
    expect(meetsGoal(bildschirm, 2)).toBe(true);
    expect(meetsGoal(bildschirm, 3)).toBe(false);
  });

  it('ohne Grenzen reicht der Eintrag', () => {
    expect(meetsGoal({ ...schlaf, points_from: null, penalty_from: null }, 1)).toBe(true);
    expect(meetsGoal({ ...schlaf, tracking_type: 'done' }, 1)).toBe(true);
  });
});
