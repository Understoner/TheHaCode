import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Ein Schalter, der zum Menschen gehoert und nicht zum Geraet.
 *
 * Bisher stand diese Mechanik einmal fuer den Ton da (useSoundPreference,
 * Backlog T10). Mit der gesprochenen Ansage kam ein zweiter Schalter derselben
 * Art dazu - abgeschaltet soll abgeschaltet bleiben, auch auf dem naechsten
 * Geraet. Statt neunzig Zeilen zu verdoppeln, steht die Mechanik jetzt einmal
 * hier und die beiden Schalter daneben sind je vier Zeilen.
 *
 * EINE ABFRAGE FUER BEIDE SCHALTER
 * --------------------------------
 * Gelesen wird die ganze Zeile, nicht je Schalter eine Spalte: zwei Hooks im
 * selben Screen ergaeben sonst zwei Anfragen fuer dieselbe Zeile. Der
 * gemeinsame Abfrageschluessel sorgt dafuer, dass es eine bleibt.
 *
 * OHNE ANMELDUNG bleibt es bei der oertlichen Einstellung - eine Zeile in
 * profiles gibt es dann nicht, und localStorage ist fuer fachliche Daten
 * verboten (CLAUDE.md). Der Schalter gilt dann fuer die Dauer des Besuchs, und
 * das ist in Ordnung: es geht um Bequemlichkeit, nicht um Daten.
 *
 * EINE QUELLE, NICHT ZWEI
 * -----------------------
 * Der angezeigte Zustand kommt fuer Angemeldete ausschliesslich aus dem Cache
 * der Abfrage - umgeschaltet wird, indem dieser Cache gesetzt wird. Ein
 * zweiter Zustand daneben, der per useEffect nachgezogen wird, sieht harmloser
 * aus als er ist: zwischen dem Schreiben und der Antwort des Servers liegt ein
 * Moment, in dem eine noch laufende Abfrage den alten Wert zurueckliefert und
 * den Schalter wieder umlegt. Genau das ist beim Testen passiert.
 *
 * Geschrieben wird optimistisch: ein Schalter, der erst nach der Antwort
 * umspringt, fuehlt sich kaputt an. Geht das Speichern schief, wird der alte
 * Wert zurueckgesetzt - der Schaden waere ein falsch gemerkter Schalter, kein
 * verlorener Inhalt.
 */
export type ProfileFlag = 'sound_enabled' | 'voice_enabled';

type Flags = Partial<Record<ProfileFlag, boolean | null>>;

/**
 * Die Aenderung als getipptes Objekt statt als berechneter Schluessel: eine
 * Zuweisung mit variablem Feldnamen laesst sich nicht gegen das generierte
 * Schema pruefen, und genau diese Pruefung ist der Grund, warum die Typen
 * generiert werden (CLAUDE.md).
 */
function patchFor(flag: ProfileFlag, value: boolean) {
  return flag === 'sound_enabled' ? { sound_enabled: value } : { voice_enabled: value };
}

export function useProfileFlag(flag: ProfileFlag, fallback: boolean) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const key = ['profile-flags', userId] as const;

  // Nur fuer Nichtangemeldete. Fuer alle anderen ist der Cache die Wahrheit.
  const [ohneKonto, setOhneKonto] = useState(fallback);

  const query = useQuery({
    queryKey: key,
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<Flags> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('sound_enabled, voice_enabled')
        .eq('id', userId!)
        .maybeSingle();

      if (error) throw error;
      return data ?? {};
    },
  });

  const speichern = useMutation({
    mutationFn: async (value: boolean): Promise<void> => {
      const { error } = await supabase.from('profiles').update(patchFor(flag, value)).eq('id', userId!);
      if (error) throw error;
    },
    onMutate: async (value) => {
      // Eine laufende Abfrage wuerde sonst gleich wieder den alten Wert
      // schreiben.
      await queryClient.cancelQueries({ queryKey: key });
      const vorher = queryClient.getQueryData<Flags>(key);
      queryClient.setQueryData<Flags>(key, { ...vorher, [flag]: value });
      return { vorher };
    },
    onError: (_error, _value, context) => {
      if (context?.vorher !== undefined) queryClient.setQueryData<Flags>(key, context.vorher);
    },
  });

  const setValue = (value: boolean) => {
    if (userId) {
      speichern.mutate(value);
      return;
    }
    setOhneKonto(value);
  };

  // Solange die erste Antwort aussteht, gilt der Vorgabewert der Spalte - die
  // freundlichere Annahme.
  const value = userId ? (query.data?.[flag] ?? fallback) : ohneKonto;

  return { value, setValue };
}
