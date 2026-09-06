import { useProfileFlag } from '@/features/settings/useProfileFlag';

/**
 * Ob die Phasentoene laufen sollen - geraeteuebergreifend, aus
 * profiles.sound_enabled (Migration 0001, Backlog T10).
 *
 * Vorgabe an: der Ton ist die Grundausstattung des Players. Die Mechanik
 * dahinter steht in useProfileFlag.
 */
export function useSoundPreference() {
  const { value, setValue } = useProfileFlag('sound_enabled', true);
  return { soundOn: value, setSoundOn: setValue };
}
