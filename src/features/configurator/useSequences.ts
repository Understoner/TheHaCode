import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { PlayableExercise } from '@/types/breathing';
import type { SequenceValues } from '@/features/configurator/schema';

const TREE = '*, exercise_steps(*, exercise_phases(*))';

/**
 * Ob der Konfigurator benutzbar ist.
 *
 * Gefragt wird ausschliesslich has_plus_access(), nie profiles.has_active_subscription
 * (CLAUDE.md §Zugriff). Kaeme spaeter ein Gutschein oder eine Aktion dazu,
 * aendert sich genau diese eine Datenbankfunktion - und hier nichts.
 */
export function usePlusAccess() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['plus-access', userId],
    // Ohne Anmeldung gibt es nichts zu fragen: has_plus_access() liefert dann
    // ohnehin false, aber ein Aufruf waere eine Runde umsonst.
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('has_plus_access');
      if (error) throw error;
      return data === true;
    },
  });
}

/** Die eigenen Sequenzen. Welche das sind, entscheidet RLS - nicht dieser Filter. */
export function useMySequences() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['my-sequences', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<PlayableExercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select(TREE)
        .eq('owner_id', userId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PlayableExercise[];
    },
  });
}

/**
 * Anlegen und Aendern laufen ueber dieselbe Datenbankfunktion: eine Sequenz
 * steht in drei Tabellen, und drei einzelne Aufrufe koennten mittendrin
 * abbrechen (Begruendung in Migration 0009).
 */
export function useSaveSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string | null;
      values: SequenceValues;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('save_exercise', {
        p_exercise_id: id as string,
        p_title: values.title,
        p_subtitle: values.subtitle,
        p_steps: values.steps.map((step) => ({
          label: step.label,
          repeat_count: step.repeat_count,
          rest_seconds: step.rest_seconds,
          phases: step.phases.map((phase) => ({
            kind: phase.kind,
            duration_seconds: phase.duration_seconds,
          })),
        })),
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['my-sequences'] });
      // Der Player liest ueber denselben Schluessel - ohne das zeigte er nach
      // dem Speichern noch den alten Stand.
      void queryClient.invalidateQueries({ queryKey: ['exercise', id] });
    },
  });
}

/**
 * Loeschen bleibt IMMER erlaubt, auch ohne Plus (SAD §3.4, Policy
 * exercises_delete_own). Wer nicht mehr zahlt, darf seine Sachen weiterhin
 * abspielen und wegraeumen - nur nichts Neues bauen.
 */
export function useDeleteSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('exercises').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-sequences'] });
    },
  });
}
