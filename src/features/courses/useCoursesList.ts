import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Course = Database['public']['Tables']['courses']['Row'];

export function useCoursesList() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        // Nach Termin, der naechste zuerst. Vorher entschied allein
        // sort_order - dann bestimmt die Reihenfolge, wer zuletzt eine Zahl
        // vergeben hat, und nicht der Kalender. Bei zwoelf Terminen einer
        // Reihe faellt das sofort auf.
        //
        // nullsFirst: false, weil ein Kurs ohne Termin (starts_at ist
        // nullable) sonst vor allen datierten stuende. Ohne Datum gehoert er
        // ans Ende, nicht an den Anfang.
        //
        // sort_order bleibt als zweites Kriterium: zwei Kurse zur selben
        // Stunde sollen eine feste Reihenfolge haben und nicht bei jedem
        // Abruf eine andere.
        .order('starts_at', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
