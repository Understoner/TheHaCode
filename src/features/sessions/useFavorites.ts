import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Der Stern an einer Sequenz - fuer redaktionelle wie fuer selbst gebaute.
 *
 * EINE ABFRAGE FUER ALLE STERNE
 * -----------------------------
 * Gelesen werden alle Favoriten der Person auf einmal, nicht je Karte einer:
 * eine Liste mit zwanzig Sequenzen wuerde sonst zwanzig Anfragen ausloesen.
 * Die Menge ist klein (ein Stern ist eine Zeile mit einer ID), und der
 * gemeinsame Abfrageschluessel sorgt dafuer, dass Liste, Konfigurator und
 * Player dieselbe Antwort benutzen.
 *
 * Der user_id-Bezug steht ausdruecklich in jeder Abfrage, obwohl RLS ohnehin
 * nur die eigenen Zeilen herausgibt - CLAUDE.md verlangt ihn (§Verboten:
 * Abfragen auf Nutzertabellen ohne user_id-Bezug). Zwei Schloesser an einer
 * Tuer, von der eines still aufginge, waere eines zu wenig.
 *
 * OHNE ANMELDUNG gibt es keine Favoriten. Anders als beim Tonschalter gibt es
 * hier auch keinen oertlichen Ersatz: ein Favorit ist eine fachliche Angabe,
 * und localStorage ist dafuer verboten (CLAUDE.md). Der Stern fuehrt dann zum
 * Konto - siehe components/FavoriteStar.tsx.
 */
function favoritesKey(userId: string | null) {
  return ['favorites', userId] as const;
}

export function useFavorites() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  const query = useQuery({
    queryKey: favoritesKey(userId),
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('exercise_favorites')
        .select('exercise_id')
        .eq('user_id', userId!)
        .is('deleted_at', null);

      if (error) throw error;
      return (data ?? []).map((row) => row.exercise_id);
    },
  });

  // Ein Set statt eines Arrays: die Listen fragen je Karte "ist die dabei?",
  // und bei zwanzig Karten waere das zwanzig Mal ein Durchlauf durch alle
  // Favoriten.
  const ids = useMemo(() => new Set(query.data ?? []), [query.data]);

  return {
    /** Ob ueberhaupt jemand angemeldet ist - ohne Konto gibt es keine Sterne. */
    angemeldet: userId !== null,
    ids,
    istFavorit: (exerciseId: string) => ids.has(exerciseId),
    /** Solange die erste Antwort aussteht, ist noch nichts zu filtern. */
    laedt: query.isPending && userId !== null,
  };
}

/**
 * Setzen und Entfernen in einem Hook: aus Sicht der Oberflaeche ist der Stern
 * ein Schalter, kein Paar aus zwei Aktionen.
 *
 * Geschrieben wird optimistisch - ein Stern, der erst nach der Antwort des
 * Servers umspringt, fuehlt sich kaputt an (dieselbe Ueberlegung wie bei
 * useProfileFlag). Geht es schief, wird der alte Stand zurueckgesetzt; der
 * Schaden waere ein falsch gemerkter Stern, kein verlorener Inhalt.
 */
export function useToggleFavorite() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const key = favoritesKey(userId);

  return useMutation({
    mutationFn: async ({
      exerciseId,
      favorit,
    }: {
      exerciseId: string;
      favorit: boolean;
    }): Promise<void> => {
      if (!userId) throw new Error('nicht angemeldet');

      if (favorit) {
        // upsert statt insert: zwei schnelle Klicks oder ein zweites offenes
        // Fenster wuerden sonst am unique-Constraint (0017) scheitern, obwohl
        // der gewuenschte Zustand laengst hergestellt ist.
        const { error } = await supabase
          .from('exercise_favorites')
          .upsert(
            { user_id: userId, exercise_id: exerciseId },
            { onConflict: 'user_id,exercise_id', ignoreDuplicates: true }
          );
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('exercise_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);
      if (error) throw error;
    },

    onMutate: async ({ exerciseId, favorit }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const vorher = queryClient.getQueryData<string[]>(key);

      queryClient.setQueryData<string[]>(key, (alt) => {
        const ohne = (alt ?? []).filter((id) => id !== exerciseId);
        return favorit ? [...ohne, exerciseId] : ohne;
      });

      return { vorher };
    },

    onError: (_error, _variablen, context) => {
      if (context?.vorher !== undefined) queryClient.setQueryData<string[]>(key, context.vorher);
    },

    // Erst nach Erfolg UND nach Fehlschlag neu laden: danach steht in jedem
    // Fall das, was die Datenbank sagt.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
