import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

// Freischalten ohne Neuladen (Backlog T16).
//
// DAS PROBLEM, DAS DAMIT WEGGEHT
// ------------------------------
// Der Nutzer bezahlt bei Stripe und kommt zurueck. Freigeschaltet wird er aber
// nicht durch seine Rueckkehr, sondern durch den Webhook - und der braucht ein
// bis zwei Sekunden laenger. Wer sofort auf den Konfigurator klickte, sah
// weiter die Bezahlschranke und musste die Seite neu laden. Genau das stand
// seit T16 als offener Punkt im Backlog.
//
// WARUM AUF profiles UND NICHT AUF subscriptions
// ----------------------------------------------
// Weil dort der Wert steht, an dem alles haengt: has_active_subscription,
// gesetzt vom Entitlement-Trigger aus Migration 0010. Ein Ereignis auf
// subscriptions waere der Umweg dorthin - und subscriptions fuehrt
// Kundennummern und Periodengrenzen, die ueber eine offene Verbindung
// niemanden etwas angehen. profiles ist die kleinere Angriffsflaeche und die
// genauere Antwort. Freigegeben ist deshalb auch nur profiles (Migration 0013).
//
// RLS gilt hier wie ueberall: profiles_select_own sorgt dafuer, dass jeder nur
// Ereignisse zu seiner eigenen Zeile bekommt.
//
// Diese Datei entscheidet nichts. Sie wirft nur die Abfragen weg, die veraltet
// sein koennten - die Antwort holt danach wieder has_plus_access().
export function useEntitlementSync(): void {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`entitlement:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => {
          // Bewusst pauschal: welcher Wert sich geaendert hat, ist hier ohne
          // Belang. Beide Abfragen sind billig, und die Alternative waere,
          // die Fachregel aus 0010 hier ein zweites Mal aufzuschreiben.
          void queryClient.invalidateQueries({ queryKey: ['plus-access'] });
          void queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
