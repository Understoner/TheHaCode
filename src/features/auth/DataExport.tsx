import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import {
  buildExport,
  downloadJson,
  exportFileName,
  EXPORT_OWNER_COLUMN,
  EXPORT_TABLES,
} from '@/features/auth/dataExport';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { supabase } from '@/lib/supabase';
import { PressableRing } from '@/components/PressableRing';

// Alle eigenen Daten als Datei - Art. 15 und Art. 20 DSGVO.
//
// Jede Abfrage laeuft unter dem Zugangstoken des Nutzers, also unter RLS.
// Zurueck kommt deshalb ausschliesslich, was ihm gehoert - auch wenn hier
// "select *" ohne where steht. Das ist kein Versehen, sondern der Punkt:
// haette jemand eine Policy zu weit gefasst, faellt es hier auf, statt still
// zu bleiben.
export function DataExport({ session }: { session: Session }) {
  const { t } = useTranslation();
  const { run, pending, error } = useDataExport(session);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('konto.export.titel')}</Text>
      <Text style={styles.body}>{t('konto.export.text')}</Text>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PressableRing onPress={() => void run()} disabled={pending} style={styles.action}>
        <Text style={styles.actionText}>
          {pending ? t('konto.export.pending') : t('konto.export.aktion')}
        </Text>
      </PressableRing>
    </View>
  );
}

/**
 * Der Download selbst, auch fuer den Widerruf der Tagebuch-Einwilligung
 * (HealthDataRevoke, 03.11.2026): dort laedt man vor dem Loeschen eine Kopie.
 */
export function useDataExport(session: Session) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setPending(true);

    try {
      const daten: Record<string, unknown[]> = {};

      for (const table of EXPORT_TABLES) {
        const ownerColumn = EXPORT_OWNER_COLUMN[table];
        // Seitenweise (Review 11.11.2026, E1): der Server gibt je Anfrage
        // hoechstens 1000 Zeilen heraus und meldet das Abschneiden nicht.
        // Ohne Blaettern fehlten in der Auskunft - und in der Kopie vor dem
        // Loeschen des Tagebuchs - still alle Zeilen danach. Jede dieser
        // Tabellen hat eine Spalte id; sie macht die Reihenfolge eindeutig.
        daten[table] = await fetchAllRows<unknown>((from, to) => {
          const query = supabase.from(table).select('*', { count: 'exact' });
          return (ownerColumn ? query.eq(ownerColumn, session.user.id) : query)
            .order('id')
            .range(from, to);
        });
      }

      const dokument = buildExport(
        { id: session.user.id, email: session.user.email ?? null },
        daten,
      );

      downloadJson(
        typeof document === 'undefined' ? undefined : document,
        exportFileName(),
        dokument,
      );
    } catch {
      setError(t('errors:konto.export'));
    } finally {
      setPending(false);
    }
  };

  return { run, pending, error };
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  action: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.full,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
});
