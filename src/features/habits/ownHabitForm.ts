// Formularregeln fuer eigene Habits - dieselben Grenzen wie der Trigger in
// Migration 0024, damit der Nutzer eine verstaendliche Meldung bekommt statt
// eines Datenbankfehlers. Die Datenbank prueft trotzdem selbst.

import { z } from 'zod';

import { currentOrigin, isValidHabitLink, normalizeHabitLink } from './habitLink';
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
    // Punkte nach Wert (0035), nur fuer Zahlen-Habits ohne Abzug. Leer = keine
    // Grenze.
    higherIsBetter: z.boolean(),
    pointsFrom: optionalNumber,
    penaltyFrom: optionalNumber,
    penaltyPoints: z
      .number()
      .int()
      .min(0, { error: 'errors:habits.points' })
      .max(10, { error: 'errors:habits.points' }),
    link: z
      .string()
      .trim()
      .max(500, { error: 'errors:habits.linkLong' })
      .refine((value) => value === '' || isValidHabitLink(value), {
        error: 'errors:habits.link',
      }),
  })
  .refine(
    (v) =>
      v.trackingType !== 'number' ||
      v.minValue === '' ||
      v.maxValue === '' ||
      toNumber(v.minValue)! <= toNumber(v.maxValue)!,
    { error: 'errors:habits.range', path: ['maxValue'] },
  )
  .refine(
    (v) => {
      if (v.trackingType !== 'number' || v.isNegative) return true;
      const plus = toNumber(v.pointsFrom);
      const minus = toNumber(v.penaltyFrom);
      if (plus === null || minus === null) return true;
      return v.higherIsBetter ? minus <= plus : minus >= plus;
    },
    { error: 'errors:habits.valueOrder', path: ['penaltyFrom'] },
  );

export type OwnHabitValues = z.infer<typeof ownHabitSchema>;

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed.replace(',', '.'));
}

/** Formularwerte in das, was useSaveOwnHabit schreibt. */
export function toOwnHabitInput(
  values: OwnHabitValues,
  appOrigin: string | null = currentOrigin(),
): OwnHabitInput {
  const number = values.trackingType === 'number';
  // Grenzen nur an Zahlen-Habits ohne Abzug - die Datenbank lehnt sie sonst ab.
  const valueRule = number && !values.isNegative;
  const penaltyFrom = valueRule ? toNumber(values.penaltyFrom) : null;
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
    higherIsBetter: values.higherIsBetter,
    pointsFrom: valueRule ? toNumber(values.pointsFrom) : null,
    penaltyFrom,
    penaltyPoints: penaltyFrom === null ? null : values.penaltyPoints,
    link: normalizeHabitLink(values.link, appOrigin),
  };
}
