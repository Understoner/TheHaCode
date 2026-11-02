// Stimmungen, Session-Arten und die Atemform (02.11.2026, Vorschlag
// "Mondlicht Mobile", nur Testsystem). Reine Funktionen, ohne Browser testbar.

import type { ExerciseEffect } from '@/features/sessions/effects';
import type { PhaseKind, PlayableExercise } from '@/types/breathing';

// ---------------------------------------------------------------------------
// Stimmungen: "Wie willst du dich fuehlen?"
// ---------------------------------------------------------------------------

export type Mood = 'wach' | 'fokus' | 'ruhig' | 'schlafen';

export const MOODS: Mood[] = ['wach', 'fokus', 'ruhig', 'schlafen'];

/**
 * Die Stimmungen einer Session, abgeleitet aus ihren Wirkungs-Chips
 * (Entscheidung des Users vom 02.11.2026 - kein eigenes Feld im Studio).
 *
 *   Wach     = aktivierend
 *   Fokus    = CO2-Toleranz, oder aktivierend zusammen mit Stressreduktion
 *              (wach UND gesammelt - "Activation-to-Focus")
 *   Ruhig    = entspannend oder Stressreduktion, aber nicht aktivierend
 *   Schlafen = entspannend, weder aktivierend noch CO2-Training
 *
 * Eine Session kann in mehreren Stimmungen stehen. Eine ohne Wirkungs-Chip
 * steht in keiner - sie bleibt unter "Alle" sichtbar.
 */
export function moodsOf(effects: readonly ExerciseEffect[]): Mood[] {
  const has = (e: ExerciseEffect) => effects.includes(e);
  const aktiv = has('aktivierend');
  const co2 = has('co2_toleranz');
  const result: Mood[] = [];
  if (aktiv) result.push('wach');
  if (co2 || (aktiv && has('stressreduktion'))) result.push('fokus');
  if (!aktiv && (has('entspannend') || has('stressreduktion'))) result.push('ruhig');
  if (!aktiv && !co2 && has('entspannend')) result.push('schlafen');
  return result;
}

export function parseMood(raw: string | string[] | undefined): Mood | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (MOODS as string[]).includes(value ?? '') ? (value as Mood) : null;
}

// ---------------------------------------------------------------------------
// Der Vorschlag zur Tageszeit
// ---------------------------------------------------------------------------

export type DaySlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export function daySlot(date: Date): DaySlot {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'midday';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

const SLOT_MOOD: Record<DaySlot, Mood> = {
  morning: 'wach',
  midday: 'fokus',
  afternoon: 'fokus',
  evening: 'ruhig',
  night: 'schlafen',
};

/**
 * Die erste Session (in Redaktionsreihenfolge), die zur Tageszeit passt.
 * Passt keine, gibt es keinen Vorschlag - lieber nichts als etwas Falsches.
 * Nur Box-Sessions: eine Aufnahme laesst sich (noch) nicht abspielen.
 */
export function suggestFor<T extends { effects: readonly ExerciseEffect[] }>(
  sessions: readonly T[],
  date: Date,
  kindOf: (session: T) => SessionKind,
): T | null {
  const mood = SLOT_MOOD[daySlot(date)];
  return sessions.find((s) => kindOf(s) === 'box' && moodsOf(s.effects).includes(mood)) ?? null;
}

// ---------------------------------------------------------------------------
// Die Art einer Session: Box (Lotus), Audio oder Video
// ---------------------------------------------------------------------------

export type SessionKind = 'box' | 'audio' | 'video';

/**
 * Woran eine Session als Aufnahme erkennbar ist, steht seit 0007 in der
 * Tabelle (SAD §3.4, §7.2): ein Video hat video_external_id, eine gesprochene
 * Session einen playback_mode ausser "timer" (die Datenbank verlangt dann
 * audio_path). Alles andere ist eine Box-Sequenz aus Phasen.
 */
export function sessionKind(
  exercise: Pick<PlayableExercise, 'playback_mode' | 'video_external_id'>,
): SessionKind {
  if (exercise.video_external_id) return 'video';
  if (exercise.playback_mode !== 'timer') return 'audio';
  return 'box';
}

// ---------------------------------------------------------------------------
// Die Atemform als Kurve: oben = Lunge voll
// ---------------------------------------------------------------------------

export type ProfilePhase = { kind: PhaseKind; seconds: number };

/** Die Phasen der ersten Runde des ersten Blocks, in Reihenfolge. */
export function firstRound(exercise: PlayableExercise): ProfilePhase[] {
  const step = [...exercise.exercise_steps].sort((a, b) => a.position - b.position)[0];
  if (!step) return [];
  return [...step.exercise_phases]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ kind: p.kind, seconds: Number(p.duration_seconds) }))
    .filter((p) => Number.isFinite(p.seconds) && p.seconds > 0);
}

/** Lungenfuellung am Ende einer Phase, ausgehend von der Fuellung davor. */
function levelAfter(kind: PhaseKind, before: number): number {
  if (kind === 'inhale') return 1;
  if (kind === 'exhale') return 0;
  return before;
}

/**
 * SVG-Pfad der Atemform: x ist die Zeit, y die Lungenfuellung. Halten bleibt
 * waagrecht, Ein steigt, Aus faellt. Freies Atmen und Pausen halten die Hoehe.
 */
export function profilePath(
  phases: readonly ProfilePhase[],
  box: { width: number; height: number; padX: number; padY: number },
): string {
  const total = phases.reduce((sum, p) => sum + p.seconds, 0);
  if (total <= 0) return '';
  const inner = box.width - box.padX * 2;
  const top = box.padY;
  const bottom = box.height - box.padY;
  const y = (level: number) => (bottom - (bottom - top) * level).toFixed(1);
  let x = box.padX;
  let level = 0;
  let d = `M${x.toFixed(1)} ${y(level)}`;
  for (const p of phases) {
    x += (p.seconds / total) * inner;
    level = levelAfter(p.kind, level);
    d += ` L${x.toFixed(1)} ${y(level)}`;
  }
  return d;
}

/**
 * Skalierung des Lotus im Verlauf einer Runde: 0 = ganz ausgeatmet,
 * 1 = ganz eingeatmet. Je Phase ein Zielwert und ihre Dauer.
 */
export function profileKeyframes(phases: readonly ProfilePhase[]): { to: number; ms: number }[] {
  let level = 0;
  return phases.map((p) => {
    level = levelAfter(p.kind, level);
    return { to: level, ms: Math.round(p.seconds * 1000) };
  });
}

/** Die vorherrschende Tonfarbe einer Session - nach ihrer ersten Stimmung. */
export function leadMood(effects: readonly ExerciseEffect[]): Mood | null {
  return moodsOf(effects)[0] ?? null;
}
