import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import type { SequenceFormValues } from '@/features/configurator/schema';
import type { PlayableExercise } from '@/types/breathing';

// Der Formularstand ist waehrend des Tippens unvollstaendig: ein neu
// angelegter Block hat kurz noch keine Phasen, ein geleertes Feld ist ''
// statt einer Zahl. useWatch liefert deshalb einen teilweisen Baum, und
// genau den nimmt die Vorschau entgegen - statt einen vollstaendigen zu
// behaupten und beim ersten leeren Feld abzustuerzen.
type Teilweise = {
  title?: string;
  subtitle?: string;
  steps?: (
    | {
        label?: string;
        repeat_count?: string;
        rest_seconds?: string;
        phases?: ({ kind?: SequenceFormValues['steps'][number]['phases'][number]['kind']; duration_seconds?: string } | undefined)[];
      }
    | undefined
  )[];
};

// Die Vorschau im Konfigurator rechnet NICHT selbst.
//
// Naheliegend waere eine kleine Formel "Runden mal Phasensumme plus Pause" -
// und sie waere heute sogar richtig. Sie wuerde aber ab dem Tag danebenliegen,
// an dem die Engine etwas dazulernt, das der Editor spaeter auch kann
// (Progression ueber die Runden steht in exercise_phases bereits als Spalte).
// Dann zeigte der Editor eine andere Dauer an als der Player spaeter
// abspielt, und niemand wuesste, welche stimmt.
//
// Deshalb wird der Formularstand in genau den Baum uebersetzt, den die Engine
// ohnehin verarbeitet, und dieselbe buildTimeline gefragt, die auch der Player
// benutzt. Eine Wahrheit, zwei Ansichten.

function zahl(value: string, fallback = 0): number {
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Formularstand -> Engine-Baum. Die Felder, die der Editor nicht anbietet,
 * bekommen die Werte, die auch save_exercise setzt (Migration 0009); der Cast
 * steht einmal hier statt an jeder Verwendungsstelle.
 */
export function toPlayable(values: Teilweise): PlayableExercise {
  return {
    id: 'vorschau',
    title: values.title ?? '',
    subtitle: values.subtitle ?? '',
    exercise_steps: (values.steps ?? []).map((step, stepIndex) => ({
      id: `s${stepIndex}`,
      position: stepIndex + 1,
      label: step?.label ?? '',
      repeat_count: Math.max(1, Math.round(zahl(step?.repeat_count ?? '', 1))),
      rest_seconds: zahl(step?.rest_seconds ?? ''),
      exercise_phases: (step?.phases ?? []).map((phase, phaseIndex) => ({
        id: `p${stepIndex}-${phaseIndex}`,
        position: phaseIndex + 1,
        kind: phase?.kind ?? 'inhale',
        duration_seconds: zahl(phase?.duration_seconds ?? ''),
        is_open_ended: false,
        duration_delta_per_round: 0,
        max_duration_seconds: null,
        cue_text: null,
      })),
    })),
  } as unknown as PlayableExercise;
}

/** Gesamtdauer des aktuellen Formularstands in Millisekunden. */
export function previewDurationMs(values: Teilweise): number {
  return totalDurationMs(buildTimeline(toPlayable(values)));
}

/** "4-4-4-4" - die Kurzform des ersten Blocks, wie sie in der Liste steht. */
export function previewRhythm(values: Teilweise): string | null {
  const step = values.steps?.[0];
  if (!step || !step.phases || step.phases.length === 0) return null;
  return step.phases
    .map((phase) => {
      const n = zahl(phase?.duration_seconds ?? '');
      return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
    })
    .join('-');
}
