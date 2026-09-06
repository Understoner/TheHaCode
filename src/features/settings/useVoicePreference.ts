import { useProfileFlag } from '@/features/settings/useProfileFlag';

/**
 * Ob die gesprochenen Phasenansagen laufen sollen - geraeteuebergreifend, aus
 * profiles.voice_enabled (Migration 0016).
 *
 * Vorgabe AUS, anders als beim Ton: eine Ansage bei jedem Phasenwechsel ist
 * eine deutliche Entscheidung, keine Grundeinstellung. Wer die Uebung kennt,
 * will den Takt hoeren, nicht das Wort.
 */
export function useVoicePreference() {
  const { value, setValue } = useProfileFlag('voice_enabled', false);
  return { voiceOn: value, setVoiceOn: setValue };
}
