import { useProfileFlag } from '@/features/settings/useProfileFlag';

/**
 * Ob die gesprochenen Ansagen laufen sollen - geraeteuebergreifend, aus
 * profiles.voice_enabled (Migration 0016).
 *
 * Vorgabe AN seit dem 14.09.2026 (Migration 0018), wie beim Ton. Anfangs war
 * sie aus - eine Ansage bei jedem Phasenwechsel galt als Entscheidung, nicht
 * als Grundeinstellung. Seit dem Umbau des Players steht der Schalter im
 * eingeklappten Einstellungsblock; wer die Stimme nie gehoert hat, wuerde ihn
 * dort nicht suchen.
 */
export function useVoicePreference() {
  const { value, setValue } = useProfileFlag('voice_enabled', true);
  return { voiceOn: value, setVoiceOn: setValue };
}
