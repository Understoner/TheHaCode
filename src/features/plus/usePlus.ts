import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type PlanKey = 'monthly' | 'yearly';

export type PlanPrice = {
  plan: PlanKey;
  amountCents: number;
  currency: string;
  interval: string | null;
};

/**
 * Was Plus kostet - aus Stripe, nicht von uns.
 *
 * Der angezeigte Betrag kommt aus derselben Price-ID, mit der abgerechnet
 * wird (Edge Function get-prices). Damit koennen Anzeige und Abbuchung nicht
 * auseinanderlaufen, auch wenn im Dashboard jemand am Preis dreht.
 *
 * Ohne Anmeldung abrufbar: die Preisseite ist oeffentlich.
 */
export function usePrices() {
  return useQuery({
    queryKey: ['plus-prices'],
    queryFn: async (): Promise<PlanPrice[]> => {
      const { data, error } = await supabase.functions.invoke<{ prices?: PlanPrice[] }>(
        'get-prices',
        { method: 'POST' },
      );

      if (error) throw error;
      if (!data?.prices?.length) throw new Error('keine Preise');
      return data.prices;
    },
    // Preise aendern sich im Jahr vielleicht einmal. Eine Stunde ist eine
    // Stunde zu wenig, um zu schaden, und lang genug, um nicht bei jedem
    // Seitenaufruf bei Stripe anzuklopfen.
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Das eigene Abo. Welches sichtbar ist, entscheidet RLS - nicht dieser Filter.
 *
 * Bewusst NICHT die Quelle fuer "darf er den Konfigurator benutzen": das
 * beantwortet has_plus_access() (CLAUDE.md §Zugriff, siehe usePlusAccess).
 * Hier geht es allein darum, dem Nutzer seinen Vertrag zu zeigen - Tarif,
 * Laufzeit, gekuendigt oder nicht.
 */
export function useSubscription() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['my-subscription', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .is('deleted_at', null)
        .order('current_period_end', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

/** Zur Bezahlseite. Welcher Preis dahintersteht, entscheidet der Server. */
export function usePlusCheckout() {
  return useMutation({
    mutationFn: async (plan: PlanKey): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        'create-checkout',
        { method: 'POST', body: { plan } },
      );

      if (error) throw error;
      if (!data?.url) throw new Error(data?.error ?? 'unknown');
      return data.url;
    },
  });
}

/**
 * Ins Kundenportal. Dort wird gekuendigt, reaktiviert und die Zahlungsart
 * getauscht - alles bei Stripe, nichts davon bauen wir selbst.
 */
export function usePortal() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        'create-portal',
        { method: 'POST' },
      );

      if (error) throw error;
      if (!data?.url) throw new Error(data?.error ?? 'unknown');
      return data.url;
    },
  });
}
