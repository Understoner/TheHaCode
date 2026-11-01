// Formularregeln fuer das Planen einer Challenge - dieselben Grenzen wie
// Migration 0036, damit der Nutzer eine verstaendliche Meldung bekommt statt
// eines Datenbankfehlers. Die Datenbank prueft trotzdem selbst.

import { z } from 'zod';

import { addDays, type IsoDate } from '@/features/habits/dates';

import { expandPlan, MAX_CHALLENGE_DAYS, type ChallengePlan, type PlannedSlot } from './plan';
import type { SaveChallengeInput } from './useChallenges';

export type ChallengeItemValue = {
  habitTemplateId: string;
  plan: ChallengePlan;
  /** Hat vergangene Termine: bleibt in der Challenge, auch ohne neue. */
  hasPast: boolean;
};

const planSchema = z.custom<ChallengePlan>((v) => typeof v === 'object' && v !== null);

export const challengeSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: 'errors:challenges.titleRequired' })
      .max(80, { error: 'errors:challenges.titleLong' }),
    description: z.string().trim().max(500, { error: 'errors:challenges.descriptionLong' }),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'errors:challenges.start' }),
    durationDays: z
      .number()
      .int({ error: 'errors:challenges.duration' })
      .min(1, { error: 'errors:challenges.duration' })
      .max(MAX_CHALLENGE_DAYS, { error: 'errors:challenges.duration' }),
    items: z
      .array(
        z.object({
          habitTemplateId: z.string().min(1),
          plan: planSchema,
          hasPast: z.boolean(),
        }),
      )
      .min(1, { error: 'errors:challenges.noHabits' })
      .max(30, { error: 'errors:challenges.tooManyHabits' }),
  })
  .refine(
    (v) =>
      v.items.every(
        (item) => item.hasPast || expandPlan(item.plan, v.startsOn, endsOnOf(v.startsOn, v.durationDays)).length > 0,
      ),
    { error: 'errors:challenges.emptyPlan', path: ['items'] },
  );

export type ChallengeValues = z.infer<typeof challengeSchema>;

export function endsOnOf(startsOn: IsoDate, durationDays: number): IsoDate {
  return addDays(startsOn, Math.max(1, durationDays) - 1);
}

/** Tage von a bis b, b - a (fuer die Dauer einer bestehenden Challenge). */
export function durationOf(startsOn: IsoDate, endsOn: IsoDate): number {
  let n = 1;
  for (let d = startsOn; d < endsOn; d = addDays(d, 1)) n++;
  return n;
}

/** Alle Daten eines Plans um `days` verschieben - wenn sich der Start bewegt. */
export function shiftPlan(plan: ChallengePlan, days: number): ChallengePlan {
  if (days === 0) return plan;
  return {
    ...plan,
    dates: plan.dates?.map((d) => addDays(d, days)),
    blocks: plan.blocks?.map((b) => ({ ...b, start: addDays(b.start, days) })),
  };
}

/** Formularwerte in das, was save_challenge_plan() erwartet. */
export function toSaveInput(
  values: ChallengeValues,
  extra: { id?: string; templateId?: string | null },
): SaveChallengeInput {
  const endsOn = endsOnOf(values.startsOn, values.durationDays);
  return {
    id: extra.id,
    templateId: extra.templateId ?? null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    startsOn: values.startsOn,
    endsOn,
    items: values.items.map((item) => ({
      habitTemplateId: item.habitTemplateId,
      plan: item.plan,
      slots: expandPlan(item.plan, values.startsOn, endsOn) satisfies PlannedSlot[],
    })),
  };
}
