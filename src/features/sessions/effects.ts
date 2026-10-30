import { colors } from '@/design/tokens';
import type { Database } from '@/types/database';

export type ExerciseEffect = Database['public']['Enums']['exercise_effect'];

// Reihenfolge der Filterleiste. Bewusst nicht alphabetisch, sondern von
// "traineriert etwas" zu "beruhigt etwas".
export const EXERCISE_EFFECTS: ExerciseEffect[] = [
  'co2_toleranz',
  'aktivierend',
  'entspannend',
  'stressreduktion',
];

// Nur zwei Akzentfamilien in den Tokens (ocean/sage) fuer vier Effekte. Die
// Zuordnung folgt der Bedeutung statt dem Zufall: Ocean fuer alles, was
// fordert, Salbei fuer alles, was herunterfaehrt. Dass sich je zwei Effekte
// eine Farbe teilen, ist damit kein Verlust an Information - die Farbe sagt
// die Richtung, die Beschriftung den genauen Effekt.
type Tone = 'ocean' | 'sage';

const EFFECT_TONE: Record<ExerciseEffect, Tone> = {
  co2_toleranz: 'ocean',
  aktivierend: 'ocean',
  entspannend: 'sage',
  stressreduktion: 'sage',
};

export function effectColors(effect: ExerciseEffect): { text: string; tint: string } {
  return EFFECT_TONE[effect] === 'ocean'
    ? { text: colors.ocean700, tint: colors.oceanTint }
    : { text: colors.sage700, tint: colors.sageTint };
}

// ---------------------------------------------------------------------------
// Der Filter der Sessions-Liste (seit 30.10.2026 auf /sessions/filter, in der
// Adresse als ?filter=). "favoriten" steht in derselben Reihe wie die
// Wirkeffekte: beide beantworten dieselbe Frage ("welche Sequenzen sehe ich
// gerade?").
// ---------------------------------------------------------------------------

export type SessionFilter = ExerciseEffect | 'all' | 'favoriten';

export const SESSION_FILTERS: SessionFilter[] = ['all', 'favoriten', ...EXERCISE_EFFECTS];

export function parseSessionFilter(raw: string | string[] | undefined): SessionFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (SESSION_FILTERS as string[]).includes(value ?? '') ? (value as SessionFilter) : 'all';
}
