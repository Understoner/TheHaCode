import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Ob die Toene laufen sollen - und zwar geraeteuebergreifend.
 *
 * Bisher lebte diese Einstellung nur im useState des Players: wer den Ton
 * abschaltete, hatte ihn beim naechsten Oeffnen wieder an. Die Spalte
 * profiles.sound_enabled gibt es seit Migration 0001, gelesen hat sie niemand
 * (Backlog T10).
 *
 * Ohne Anmeldung bleibt es bei der oertlichen Einstellung - eine Zeile in
 * profiles gibt es dann nicht, und localStorage ist fuer fachliche Daten
 * verboten (CLAUDE.md). Der Ton ist dann fuer die Dauer des Besuchs
 * eingestellt, und das ist in Ordnung: es geht um Bequemlichkeit, nicht um
 * Daten.
 *
 * EINE QUELLE, NICHT ZWEI
 * -----------------------
 * Der angezeigte Zustand kommt fuer Angemeldete ausschliesslich aus dem Cache
 * der Abfrage - umgeschaltet wird, indem dieser Cache gesetzt wird. Ein
 * zweiter Zustand daneben, der per useEffect nachgezogen wird, sieht
 * harmloser aus als er ist: zwischen dem Schreiben und der Antwort des Servers
 * liegt ein Moment, in dem eine noch laufende Abfrage den alten Wert
 * zurueckliefert und den Schalter wieder umlegt. Genau das ist beim Testen
 * passiert.
 *
 * Geschrieben wird optimistisch: ein Tonschalter, der erst nach der Antwort
 * umspringt, fuehlt sich kaputt an. Geht das Speichern schief, wird der alte
 * Wert zurueckgesetzt - der Schaden waere ein falsch gemerkter Schalter, kein
 * verlorener Inhalt.
 */
export function useSoundPreference() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const key = ['sound-enabled', userId] as const;

  // Nur fuer Nichtangemeldete. Fuer alle anderen ist der Cache die Wahrheit.
  const [ohneKonto, setOhneKonto] = useState(true);

  const query = useQuery({
    queryKey: key,
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('sound_enabled')
        .eq('id', userId!)
        .maybeSingle();

      if (error) throw error;
      return data?.sound_enabled ?? true;
    },
  });

  const speichern = useMutation({
    mutationFn: async (enabled: boolean): Promise<void> => {
      const { error } = await supabase
        .from('profiles')
        .update({ sound_enabled: enabled })
        .eq('id', userId!);

      if (error) throw error;
    },
    onMutate: async (enabled) => {
      // Eine laufende Abfrage wuerde sonst gleich wieder den alten Wert
      // schreiben.
      await queryClient.cancelQueries({ queryKey: key });
      const vorher = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData<boolean>(key, enabled);
      return { vorher };
    },
    onError: (_error, _enabled, context) => {
      if (context?.vorher !== undefined) queryClient.setQueryData<boolean>(key, context.vorher);
    },
  });

  const setSoundOn = (enabled: boolean) => {
    if (userId) {
      speichern.mutate(enabled);
      return;
    }
    setOhneKonto(enabled);
  };

  // Solange die erste Antwort aussteht, ist der Ton an - das ist der
  // Vorgabewert der Spalte und die freundlichere Annahme.
  const soundOn = userId ? (query.data ?? true) : ohneKonto;

  return { soundOn, setSoundOn };
}
