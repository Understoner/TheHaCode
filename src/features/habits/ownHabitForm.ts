// Formularregeln fuer eigene Habits - dieselben Grenzen wie der Trigger in
// Migration 0024, damit der Nutzer eine verstaendliche Meldung bekommt statt
// eines Datenbankfehlers. Die Datenbank prueft trotzdem selbst.

import { z } from 'zod';

import type { OwnHabitInput } from './useHabits';

const optionalNumber = z
  .string()
  .trim()
  .refine((value) => value === '' || Number.isFinite(Number(value.replace(',', '.'))), {
    error: 'errors:habits.number',
  });

export const ownHabitSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: 'errors:habits.titleRequired' })
      .max(80, { error: 'errors:habits.titleLong' }),
    description: z.string().trim().max(500, { error: 'errors:habits.descriptionLong' }),
    categoryId: z.string().min(1, { error: 'errors:habits.categoryRequired' }),
    trackingType: z.enum(['done', 'number']),
    unit: z.string().trim().max(20, { error: 'errors:habits.unitLong' }),
    minValue: optionalNumber,
    maxValue: optionalNumber,
    points: z.number().int().min(0, { error: 'errors:habits.points' }).max(10, { error: 'errors:habits.points' }),
    isNegative: z.boolean(),
  })
  .refine(
    (v) =>
      v.trackingType !== 'number' ||
      v.minValue === '' ||
      v.maxValue === '' ||
      toNumber(v.minValue)! <= toNumber(v.maxValue)!,
    { error: 'errors:habits.range', path: ['maxValue'] },
  );

export type OwnHabitValues = z.infer<typeof ownHabitSchema>;

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed.replace(',', '.'));
}

/** Formularwerte in das, was useSaveOwnHabit schreibt. */
export function toOwnHabitInput(values: OwnHabitValues): OwnHabitInput {
  const number = values.trackingType === 'number';
  return {
    categoryId: values.categoryId,
    title: values.title.trim(),
    description: values.description.trim() || null,
    trackingType: values.trackingType,
    unit: number ? values.unit.trim() || null : null,
    minValue: number ? toNumber(values.minValue) : null,
    maxValue: number ? toNumber(values.maxValue) : null,
    points: values.points,
    isNegative: values.isNegative,
  };
}
