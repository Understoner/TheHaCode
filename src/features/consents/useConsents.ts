import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type ConsentDefinition = Database['public']['Tables']['consent_definitions']['Row'];
export type UserConsent = Database['public']['Tables']['user_consents']['Row'];
export type ConsentKind = Database['public']['Enums']['consent_kind'];

export type ConsentState = {
  definition: ConsentDefinition;
  /** Die juengste Erklaerung zu dieser Art, oder null. */
  latest: UserConsent | null;
  granted: boolean;
};

/**
 * Alle veroeffentlichten Einwilligungsfassungen mit dem eigenen Stand.
 *
 * Welche Fassungen es gibt, entscheidet die Datenbank: unveroeffentlichte sind
 * durch die Lesepolicy unsichtbar. Genau daran haengt, dass in V1 nirgends
 * eine Gesundheitsdaten-Einwilligung auftaucht (Migration 0012) - hier steht
 * bewusst keine Ausschlussliste, die man beim Tagebuch vergessen koennte.
 */
export function useConsents() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['consents', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<ConsentState[]> => {
      const [definitions, mine] = await Promise.all([
        supabase
          .from('consent_definitions')
          .select('*')
          .not('published_at', 'is', null)
          .order('kind', { ascending: true }),
        supabase.from('user_consents').select('*').order('seq', { ascending: false }),
      ]);

      if (definitions.error) throw definitions.error;
      if (mine.error) throw mine.error;

      // Je Art nur die neueste Fassung anzeigen - aeltere Versionen sind
      // Nachweis, keine Handlungsoption.
      const neueste = new Map<ConsentKind, ConsentDefinition>();
      for (const definition of definitions.data ?? []) {
        const bisher = neueste.get(definition.kind);
        if (!bisher || definition.version > bisher.version) neueste.set(definition.kind, definition);
      }

      return [...neueste.values()].map((definition) => {
        // Die Liste kommt absteigend nach seq - der erste Treffer ist der
        // juengste. seq und nicht created_at: zwei Erklaerungen aus derselben
        // Transaktion tragen denselben Zeitstempel (Migration 0012).
        const latest = (mine.data ?? []).find((row) => row.kind === definition.kind) ?? null;

        return {
          definition,
          latest,
          granted: Boolean(latest?.granted_at) && !latest?.revoked_at,
        };
      });
    },
  });
}

/**
 * Zustimmen oder widerrufen - immer als neue Zeile.
 *
 * Es gibt bewusst kein Update: der Verlauf ist der Nachweis. Die Datenbank
 * laesst auch gar nichts anderes zu (Migration 0012, geprueft in
 * 013_consents.test.sql).
 */
export function useSetConsent() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      definition,
      granted,
    }: {
      definition: ConsentDefinition;
      granted: boolean;
    }): Promise<void> => {
      const userId = session?.user.id;
      if (!userId) throw new Error('unauthorized');

      const now = new Date().toISOString();
      const { error } = await supabase.from('user_consents').insert({
        user_id: userId,
        definition_id: definition.id,
        kind: definition.kind,
        granted_at: granted ? now : null,
        revoked_at: granted ? null : now,
        source: 'web',
      });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consents'] }),
  });
}
