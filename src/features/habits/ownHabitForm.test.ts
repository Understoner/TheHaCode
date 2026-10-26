import { describe, expect, it } from 'vitest';

import { ownHabitSchema, toOwnHabitInput, type OwnHabitValues } from './ownHabitForm';

const basis: OwnHabitValues = {
  title: 'Kalt duschen',
  description: '',
  categoryId: 'cat-1',
  trackingType: 'number',
  unit: 'Minuten',
  minValue: '0',
  maxValue: '30',
  points: 5,
  isNegative: false,
};

describe('ownHabitSchema', () => {
  it('nimmt ein vollstaendiges Habit an', () => {
    expect(ownHabitSchema.safeParse(basis).success).toBe(true);
  });

  it('verlangt Titel und Kategorie', () => {
    const result = ownHabitSchema.safeParse({ ...basis, title: '   ', categoryId: '' });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toContain('errors:habits.titleRequired');
    expect(messages).toContain('errors:habits.categoryRequired');
  });

  it('lehnt einen Bereich ab, dessen Minimum ueber dem Maximum liegt', () => {
    const result = ownHabitSchema.safeParse({ ...basis, minValue: '40', maxValue: '30' });
    expect(result.error?.issues[0]?.message).toBe('errors:habits.range');
  });

  it('versteht das Komma als Dezimalzeichen', () => {
    expect(ownHabitSchema.safeParse({ ...basis, minValue: '0,5', maxValue: '2,5' }).success).toBe(true);
    expect(ownHabitSchema.safeParse({ ...basis, minValue: 'abc' }).success).toBe(false);
  });
});

describe('ownHabitSchema - Punkte', () => {
  it('nimmt 0 bis 10 Punkte an, nicht mehr und nicht weniger', () => {
    expect(ownHabitSchema.safeParse({ ...basis, points: 0 }).success).toBe(true);
    expect(ownHabitSchema.safeParse({ ...basis, points: 10 }).success).toBe(true);
    expect(ownHabitSchema.safeParse({ ...basis, points: 11 }).error?.issues[0]?.message).toBe(
      'errors:habits.points',
    );
    expect(ownHabitSchema.safeParse({ ...basis, points: -1 }).success).toBe(false);
  });
});

describe('toOwnHabitInput', () => {
  it('wandelt Zahlen und leert, was zu "erledigt" nicht gehoert', () => {
    expect(toOwnHabitInput({ ...basis, minValue: '0,5' })).toMatchObject({ minValue: 0.5, maxValue: 30 });
    expect(toOwnHabitInput({ ...basis, trackingType: 'done' })).toMatchObject({
      unit: null,
      minValue: null,
      maxValue: null,
      description: null,
    });
  });

  it('reicht die Wirkung unveraendert weiter', () => {
    expect(toOwnHabitInput(basis).isNegative).toBe(false);
    expect(toOwnHabitInput({ ...basis, isNegative: true }).isNegative).toBe(true);
  });
});
