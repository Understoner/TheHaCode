import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_VOICE, parseVoiceId, type VoiceId } from '@/features/breathing/voice';
import { supabase } from '@/lib/supabase';

/**
 * Die gewaehlte Stimme, geraeteuebergreifend in profiles.voice_id (0051). Ohne
 * Konto gilt sie nur auf dieser Seite.
 *
 * Eine eigene Abfrage statt in useProfileFlag: Laeuft die neue App kurz gegen
 * das alte Schema (SAD §2.6), scheitert so nur die Stimmwahl, und es bleibt
 * die Vorgabe. Die Schalter fuer Ton und Stimme laufen weiter.
 */
export function useVoiceChoice() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const key = ['profile-voice', userId] as const;
  const [ohneKonto, setOhneKonto] = useState<VoiceId>(DEFAULT_VOICE);

  const query = useQuery({
    queryKey: key,
    enabled: !loading && userId !== null,
    retry: false,
    queryFn: async (): Promise<VoiceId> => {
      const { data, error } = await supabase.from('profiles').select('voice_id').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return parseVoiceId(data?.voice_id);
    },
  });

  const speichern = useMutation({
    mutationFn: async (value: VoiceId): Promise<void> => {
      const { error } = await supabase.from('profiles').update({ voice_id: value }).eq('id', userId!);
      if (error) throw error;
    },
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: key });
      const vorher = queryClient.getQueryData<VoiceId>(key);
      queryClient.setQueryData<VoiceId>(key, value);
      return { vorher };
    },
    onError: (_error, _value, context) => {
      queryClient.setQueryData<VoiceId>(key, context?.vorher ?? DEFAULT_VOICE);
    },
  });

  const setVoiceId = (value: VoiceId) => {
    if (userId) speichern.mutate(value);
    else setOhneKonto(value);
  };

  return { voiceId: userId ? (query.data ?? DEFAULT_VOICE) : ohneKonto, setVoiceId };
}
