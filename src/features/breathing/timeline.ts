import type { Phase, PhaseKind, PlayableExercise } from '@/types/breathing';

// Schicht 1 der Breathing Engine (SAD §7.3): der Step/Phase-Baum wird einmal
// in eine flache, absolute Zeitachse uebersetzt. Alles hier ist rein und
// deterministisch - keine Uhr, kein Zustand, keine Seiteneffekte. Genau
// deshalb laesst es sich vollstaendig in Vitest pruefen, ohne 20 Minuten
// echte Zeit vergehen zu lassen (timeline.test.ts).
//
// Der Kern der Drift-Freiheit steckt in der Form: absolute Offsets ab einem
// einzigen Ankerpunkt. Ein herunterzaehlender Timer sammelt bei jedem Tick
// seinen Fehler auf und liegt nach zehn Minuten Sekunden daneben. Hier ist
// der Fehler konstruktionsbedingt nicht kumulativ - er betraegt immer
// hoechstens eine Bilddauer (CLAUDE.md verbietet setInterval fuer
// Zeitkritisches, SAD §7.1).

export interface TimelineSegment {
  kind: PhaseKind;
  startMs: number; // absolut, ab Uebungsbeginn
  endMs: number; // exklusiv; bei openEnded nur ein Planwert
  durationMs: number;
  openEnded: boolean; // Nutzer beendet per Tippen (Retention)
  stepIndex: number;
  round: number; // 1-basiert, innerhalb des Steps
  roundsInStep: number;
  cue: string | null;
}

const SEC = 1000;

/** Progression ueber die Runden: Basisdauer + Delta je Runde, optional gedeckelt. */
function resolveDurationMs(phase: Phase, round: number): number {
  const base = Number(phase.duration_seconds);
  const delta = Number(phase.duration_delta_per_round ?? 0);
  const raw = base + delta * (round - 1);
  const capped =
    phase.max_duration_seconds != null ? Math.min(raw, Number(phase.max_duration_seconds)) : raw;
  return Math.max(0, capped) * SEC;
}

/** Wandelt den Step/Phase-Baum in eine flache, absolute Zeitachse. */
export function buildTimeline(exercise: PlayableExercise): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  let cursor = 0;

  const steps = [...exercise.exercise_steps].sort((a, b) => a.position - b.position);

  steps.forEach((step, stepIndex) => {
    const phases = [...step.exercise_phases].sort((a, b) => a.position - b.position);

    for (let round = 1; round <= step.repeat_count; round += 1) {
      for (const phase of phases) {
        const durationMs = phase.is_open_ended
          ? Number(phase.max_duration_seconds ?? 0) * SEC
          : resolveDurationMs(phase, round);

        // Phasen ohne Dauer werden uebersprungen statt als Segment der Laenge
        // 0 aufgenommen: sie waeren nie "aktuell", wuerden aber jede Suche und
        // jede Runden-Anzeige verrauschen.
        if (durationMs <= 0 && !phase.is_open_ended) continue;

        segments.push({
          kind: phase.kind,
          startMs: cursor,
          endMs: cursor + durationMs,
          durationMs,
          openEnded: phase.is_open_ended,
          stepIndex,
          round,
          roundsInStep: step.repeat_count,
          cue: phase.cue_text,
        });
        cursor += durationMs;
      }
    }
    cursor += Number(step.rest_seconds ?? 0) * SEC;
  });

  return segments;
}

/** Binaere Suche: welches Segment laeuft bei `elapsedMs`? Null = beendet. */
export function phaseAt(timeline: TimelineSegment[], elapsedMs: number): TimelineSegment | null {
  if (timeline.length === 0 || elapsedMs < 0) return null;
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = timeline[mid];
    if (elapsedMs < seg.startMs) hi = mid - 1;
    else if (elapsedMs >= seg.endMs) lo = mid + 1;
    else return seg;
  }
  return null;
}

/** Fortschritt innerhalb der aktuellen Phase, 0..1 - treibt die Animation. */
export function phaseProgress(seg: TimelineSegment, elapsedMs: number): number {
  if (seg.durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, (elapsedMs - seg.startMs) / seg.durationMs));
}

export function totalDurationMs(timeline: TimelineSegment[]): number {
  return timeline.length === 0 ? 0 : timeline[timeline.length - 1].endMs;
}

/** Index des laufenden Segments - fuer "Runde 3 von 8" und den Tonwechsel. */
export function segmentIndexAt(timeline: TimelineSegment[], elapsedMs: number): number {
  const seg = phaseAt(timeline, elapsedMs);
  return seg ? timeline.indexOf(seg) : -1;
}
