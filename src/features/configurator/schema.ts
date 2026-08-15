import { z } from 'zod';

import type { PhaseKind } from '@/types/breathing';

// Der Konfigurator - die bezahlte Funktion (CLAUDE.md §Was V1 ist).
//
// Die Grenzen hier sind bewusst DIESELBEN wie in der Datenbank (0007:
// repeat_count 1..200, Dauern >= 0, hoechstens 50 Sequenzen je Nutzer). Sie
// stehen doppelt, weil sie zwei verschiedene Aufgaben haben: die Datenbank
// laesst nichts Falsches herein, das Formular sagt es einem VOR dem Absenden.
// Wenn sich eine Grenze aendert, muessen beide Orte angefasst werden - der
// pgTAP-Test in 009_save_exercise.test.sql ist die Absicherung dagegen, dass
// man es vergisst.

/** Phasentypen, die im Konfigurator zur Wahl stehen, in der Reihenfolge eines Atemzugs. */
export const EDITABLE_PHASE_KINDS = [
  'inhale',
  'hold_in',
  'exhale',
  'hold_out',
] as const satisfies readonly PhaseKind[];

export const MAX_PHASE_SECONDS = 120;
export const MAX_REST_SECONDS = 300;
export const MAX_ROUNDS = 200;
export const MAX_BLOCKS = 10;
export const MAX_PHASES_PER_BLOCK = 8;

/**
 * Zahlen kommen aus einem Textfeld, und deutsche Nutzer tippen "5,5" statt
 * "5.5" - die App zeigt Dauern ja selbst mit Komma an. Ein Feld, das die
 * eigene Schreibweise nicht annimmt, ist ein Fehler im Formular, nicht beim
 * Nutzer.
 */
function zahl(min: number, max: number, fehler: string) {
  return z
    .string()
    .transform((value) => value.trim().replace(',', '.'))
    .refine((value) => value !== '' && Number.isFinite(Number(value)), { error: fehler })
    .transform(Number)
    .refine((value) => value >= min && value <= max, { error: fehler });
}

const phaseSchema = z.object({
  kind: z.enum(EDITABLE_PHASE_KINDS),
  duration_seconds: zahl(0.5, MAX_PHASE_SECONDS, 'errors:sequenz.dauer'),
});

const stepSchema = z.object({
  label: z.string().trim().max(60, { error: 'errors:sequenz.labelZuLang' }),
  repeat_count: zahl(1, MAX_ROUNDS, 'errors:sequenz.runden'),
  rest_seconds: zahl(0, MAX_REST_SECONDS, 'errors:sequenz.pause'),
  phases: z
    .array(phaseSchema)
    .min(1, { error: 'errors:sequenz.blockBrauchtPhase' })
    .max(MAX_PHASES_PER_BLOCK, { error: 'errors:sequenz.zuVielePhasen' }),
});

export const sequenceSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, { error: 'errors:sequenz.titel' })
    .max(80, { error: 'errors:sequenz.titelZuLang' }),
  subtitle: z.string().trim().max(120, { error: 'errors:sequenz.untertitelZuLang' }),
  steps: z
    .array(stepSchema)
    .min(1, { error: 'errors:sequenz.brauchtBlock' })
    .max(MAX_BLOCKS, { error: 'errors:sequenz.zuVieleBloecke' }),
});

/** Was im Formular steht (alles Text) ... */
export type SequenceFormValues = z.input<typeof sequenceSchema>;
/** ... und was nach der Pruefung herauskommt (Zahlen sind Zahlen). */
export type SequenceValues = z.output<typeof sequenceSchema>;

/** Ein neuer Block: Box-Atmung als Ausgangspunkt, weil sie fast jeder kennt. */
export function newStep(): SequenceFormValues['steps'][number] {
  return {
    label: '',
    repeat_count: '8',
    rest_seconds: '0',
    phases: EDITABLE_PHASE_KINDS.map((kind) => ({ kind, duration_seconds: '4' })),
  };
}

export function emptySequence(): SequenceFormValues {
  return { title: '', subtitle: '', steps: [newStep()] };
}
