import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { PlayableExercise } from '@/types/breathing';

// Eine einzige verschachtelte Abfrage liefert den ganzen Baum, den die Engine
// braucht. Welche Zeilen zurueckkommen, entscheidet allein RLS - der Client
// filtert bewusst nicht nach visibility, sonst gaebe es zwei Wahrheiten
// (007_exercises.test.sql prueft die Datenbankseite).
const TREE = '*, exercise_steps(*, exercise_phases(*))';

export function useSessionsList() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async (): Promise<PlayableExercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select(TREE)
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as PlayableExercise[];
    },
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['exercise', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<PlayableExercise> => {
      const { data, error } = await supabase.from('exercises').select(TREE).eq('id', id!).single();

      if (error) throw error;
      return data as unknown as PlayableExercise;
    },
  });
}
