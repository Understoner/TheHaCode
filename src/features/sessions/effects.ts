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
