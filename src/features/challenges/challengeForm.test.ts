import { describe, expect, it } from 'vitest';

import { challengeSchema, durationOf, endsOnOf, shiftPlan, toSaveInput, type ChallengeValues } from './challengeForm';

const basis: ChallengeValues = {
  title: '  Drei Wochen stark  ',
  description: '',
  startsOn: '2026-11-02',
  durationDays: 21,
  items: [
    {
      habitTemplateId: 'muskel',
      plan: { weekdays: [1, 3, 5] },
      hasPast: false,
    },
  ],
};

describe('challengeSchema', () => {
  it('nimmt eine vollstaendige Challenge an', () => {
    expect(challengeSchema.safeParse(basis).success).toBe(true);
  });

  it('verlangt Titel und mindestens ein Habit', () => {
    const result = challengeSchema.safeParse({
      ...basis,
      title: ' ',
      items: [],
    });
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toContain('errors:challenges.titleRequired');
    expect(messages).toContain('errors:challenges.noHabits');
  });

  it('jedes neue Habit braucht mindestens einen Termin', () => {
    const result = challengeSchema.safeParse({
      ...basis,
      items: [...basis.items, { habitTemplateId: 'leer', plan: {}, hasPast: false }],
    });
    expect(result.error?.issues[0]?.message).toBe('errors:challenges.emptyPlan');
  });

  it('ein Habit mit vergangenen Terminen darf ohne neue bleiben', () => {
    expect(
      challengeSchema.safeParse({
        ...basis,
        items: [{ habitTemplateId: 'alt', plan: {}, hasPast: true }],
      }).success,
    ).toBe(true);
  });

  it('haelt die Dauer zwischen 1 und 365 Tagen', () => {
    expect(challengeSchema.safeParse({ ...basis, durationDays: 0 }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...basis, durationDays: 366 }).success).toBe(false);
  });
});

describe('Hilfen', () => {
  it('Ende und Dauer passen zusammen', () => {
    expect(endsOnOf('2026-11-02', 21)).toBe('2026-11-22');
    expect(durationOf('2026-11-02', '2026-11-22')).toBe(21);
    expect(durationOf('2026-11-02', '2026-11-02')).toBe(1);
  });

  it('verschiebt Daten und Bloecke mit dem Start', () => {
    expect(
      shiftPlan(
        {
          weekdays: [1],
          dates: ['2026-11-05'],
          blocks: [{ start: '2026-11-09', length: 3 }],
        },
        7,
      ),
    ).toEqual({
      weekdays: [1],
      dates: ['2026-11-12'],
      blocks: [{ start: '2026-11-16', length: 3 }],
    });
  });

  it('toSaveInput rechnet die Termine und trimmt den Titel', () => {
    const input = toSaveInput(basis, { templateId: 'vorlage' });
    expect(input).toMatchObject({
      title: 'Drei Wochen stark',
      description: null,
      endsOn: '2026-11-22',
      templateId: 'vorlage',
    });
    expect(input.items[0].slots).toHaveLength(9);
  });
});
