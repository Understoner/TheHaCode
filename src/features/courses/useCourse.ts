import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Course } from '@/features/courses/useCoursesList';

// Ein einzelner Kurs ueber seinen slug - dieselbe Ueberlegung wie bei
// useNewsPost: die Adresse in der Leiste bleibt lesbar und gleich, auch wenn
// die Zeile im Studio neu angelegt wird.
//
// maybeSingle statt single: einen Kurs, den es nicht (mehr) gibt, meldet die
// Datenbank sonst als Fehler - und der Bildschirm zeigte "Laden
// fehlgeschlagen", wo "gibt es nicht" die Wahrheit ist. Welche Zeilen
// ueberhaupt sichtbar sind, entscheidet RLS: ohne published_at kommt hier
// nichts zurueck.
export function useCourse(slug: string | undefined) {
  return useQuery({
    queryKey: ['course', slug],
    enabled: Boolean(slug),
    queryFn: async (): Promise<Course | null> => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}
