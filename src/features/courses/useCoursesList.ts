import { useQuery } from '@tanstack/react-query';

import { courseDay, isPastCourse } from '@/features/courses/schedule';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Course = Database['public']['Tables']['courses']['Row'];

export function useCoursesList() {
  return useQuery({
    // Der Tag steht im Schluessel, weil er das Ergebnis beeinflusst: um
    // Mitternacht faellt der aelteste Termin heraus. Ohne ihn zeigte eine
    // ueber den Tageswechsel offene Seite den gestrigen Stand weiter.
    queryKey: ['courses', courseDay(new Date())],
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

      // Vergangene Termine werden ausgeblendet - und zwar HIER, nicht erst
      // beim Zeichnen. Sonst bekaeme QueryBoundary eine gefuellte Liste und
      // zeigte einen leeren Abschnitt statt des Leer-Zustands, sobald alle
      // Termine vorbei sind.
      //
      // Gefiltert wird nach dem Laden statt in der Abfrage: die Grenze ist
      // der Tagesbeginn in Wien, und den als Zeitpunkt auszurechnen hiesse,
      // die Sommerzeit selbst zu behandeln. Bei einer Handvoll Zeilen ist
      // das den Aufwand nicht wert - der Vergleich zweier Datumszeichen ist
      // fehlerfrei und liest sich in einer Zeile.
      //
      // Die Detailseite filtert bewusst NICHT mit: ein Link auf einen
      // vergangenen Kurs soll die Seite zeigen und nicht ins Leere laufen.
      return data.filter((course) => !isPastCourse(course.starts_at));
    },
  });
}
