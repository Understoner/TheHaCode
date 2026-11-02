import type { SequenceFormValues } from '@/features/configurator/schema';

// Hilfen fuer den Konfigurator im Vorschlag "Mondlicht Mobile" (03.11.2026,
// nur Testsystem): Plus/Minus statt Tippen und ein paar Ausgangsmuster zum
// Loslegen. Reine Funktionen, ohne Browser testbar. Die Grenzen pruefen
// weiter schema.ts und die Datenbank - hier wird nur bequem eingestellt.

/** Text aus dem Formular als Zahl; "5,5" gilt wie "5.5". Unlesbar: null. */
export function parseFormNumber(value: string): number | null {
  const n = Number(value.trim().replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Zahl so, wie das Formular sie haelt: deutsches Komma, keine unnoetigen Nachkommastellen. */
export function formatFormNumber(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/**
 * Schrittweite einer Phasendauer: fein bei kurzen Phasen, grob bei langen
 * Haltephasen - sonst braeuchte es fuer 60 s hundert Tipper.
 */
export function durationStep(seconds: number, direction: 1 | -1): number {
  const probe = direction === 1 ? seconds : seconds - 0.001;
  if (probe < 10) return 0.5;
  if (probe < 30) return 1;
  return 5;
}

/** Eine Dauer um einen Schritt weiter, eingerastet auf das Raster und begrenzt. */
export function stepDuration(value: string, direction: 1 | -1, min: number, max: number): string {
  const current = parseFormNumber(value) ?? min;
  const step = durationStep(current, direction);
  const snapped = direction === 1 ? Math.floor(current / step) * step + step : Math.ceil(current / step) * step - step;
  return formatFormNumber(Math.min(max, Math.max(min, snapped)));
}

/** Eine ganze Zahl (Runden) um eins weiter, begrenzt. */
export function stepCount(value: string, direction: 1 | -1, min: number, max: number): string {
  const current = Math.round(parseFormNumber(value) ?? min);
  return String(Math.min(max, Math.max(min, current + direction)));
}

export type QuickStartId = 'box' | 'ruhe' | 'vierSiebenAcht' | 'kohaerenz';

type Pattern = { rounds: number; phases: [SequenceFormValues['steps'][number]['phases'][number]['kind'], number][] };

/**
 * Bekannte Atemmuster als Ausgangspunkt. Es sind Muster, keine Versprechen:
 * Wirkung und Hinweise stehen bei den Sessions der Redaktion, nicht hier.
 */
export const QUICK_STARTS: Record<QuickStartId, Pattern> = {
  box: { rounds: 8, phases: [['inhale', 4], ['hold_in', 4], ['exhale', 4], ['hold_out', 4]] },
  ruhe: { rounds: 10, phases: [['inhale', 4], ['exhale', 6]] },
  vierSiebenAcht: { rounds: 4, phases: [['inhale', 4], ['hold_in', 7], ['exhale', 8]] },
  kohaerenz: { rounds: 12, phases: [['inhale', 5], ['exhale', 5]] },
};

export const QUICK_START_IDS = Object.keys(QUICK_STARTS) as QuickStartId[];

/** Ein Block nach Muster - ersetzt beim Schnellstart alle Bloecke. */
export function quickStartSteps(id: QuickStartId): SequenceFormValues['steps'] {
  const pattern = QUICK_STARTS[id];
  return [
    {
      label: '',
      repeat_count: String(pattern.rounds),
      rest_seconds: '0',
      phases: pattern.phases.map(([kind, seconds]) => ({ kind, duration_seconds: formatFormNumber(seconds) })),
    },
  ];
}
