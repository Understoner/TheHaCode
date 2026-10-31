import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Alle Tagebuch-Daten der angemeldeten Person loeschen: Eintraege, Auswahl,
// Habit-Favoriten, eigene Habits. Die Datenbankfunktion (Migration 0033)
// kennt nur auth.uid() und nimmt keinen Parameter - fremde Daten erreicht sie
// nicht. Angeboten beim Widerruf der Einwilligung health_data.
export function useDeleteDiaryData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('delete_my_diary_data');
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all(
        ['habit-logs', 'my-habits', 'habit-catalog', 'habit-favorites'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}
