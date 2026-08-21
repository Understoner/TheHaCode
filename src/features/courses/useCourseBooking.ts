import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type CourseBooking = Database['public']['Tables']['course_bookings']['Row'];

/**
 * Freie Plaetze je buchbarem Kurs.
 *
 * Ueber die Datenbankfunktion course_seats() und nicht ueber eine Abfrage auf
 * course_bookings: fremde Buchungen darf niemand sehen (Migration 0011), die
 * Summe schon. Ohne Anmeldung genauso abrufbar - die Zahl steht auf der
 * oeffentlichen Kursseite.
 */
export function useCourseSeats() {
  return useQuery({
    queryKey: ['course-seats'],
    queryFn: async (): Promise<Map<string, number | null>> => {
      const { data, error } = await supabase.rpc('course_seats');
      if (error) throw error;

      return new Map((data ?? []).map((row) => [row.course_id, row.seats_left]));
    },
    // Plaetze aendern sich, waehrend jemand die Seite ansieht. Eine Minute ist
    // kurz genug, um niemanden in einen ausgebuchten Checkout laufen zu
    // lassen, und lang genug, um nicht bei jedem Fokuswechsel zu fragen.
    staleTime: 60_000,
  });
}

/** Die eigenen Buchungen. Welche das sind, entscheidet RLS - nicht dieser Filter. */
export function useMyBookings() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['my-course-bookings', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<CourseBooking[]> => {
      const { data, error } = await supabase
        .from('course_bookings')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Buchen: Platz halten lassen und zu Stripe wechseln.
 *
 * Die Funktion gibt nur eine Adresse zurueck; alles Weitere - Platz, Preis,
 * Anzahlung - entscheidet der Server. Hier steht bewusst keine Zeile, die
 * einen Betrag berechnet: was der Client rechnet, kann der Client auch
 * aendern.
 */
export function useCourseCheckout() {
  return useMutation({
    mutationFn: async (courseSlug: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        'create-course-checkout',
        { method: 'POST', body: { courseSlug, agbAccepted: true } },
      );

      if (error) throw error;
      if (!data?.url) throw new Error(data?.error ?? 'unknown');

      return data.url;
    },
  });
}
