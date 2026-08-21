import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import {
  buildExport,
  downloadJson,
  exportFileName,
  EXPORT_TABLES,
} from '@/features/auth/dataExport';
import { supabase } from '@/lib/supabase';

// Alle eigenen Daten als Datei - Art. 15 und Art. 20 DSGVO.
//
// Jede Abfrage laeuft unter dem Zugangstoken des Nutzers, also unter RLS.
// Zurueck kommt deshalb ausschliesslich, was ihm gehoert - auch wenn hier
// "select *" ohne where steht. Das ist kein Versehen, sondern der Punkt:
// haette jemand eine Policy zu weit gefasst, faellt es hier auf, statt still
// zu bleiben.
export function DataExport({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setPending(true);

    try {
      const daten: Record<string, unknown[]> = {};

      for (const table of EXPORT_TABLES) {
        const { data, error: tableError } = await supabase.from(table).select('*');
        if (tableError) throw tableError;
        daten[table] = data ?? [];
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

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('konto.export.titel')}</Text>
      <Text style={styles.body}>{t('konto.export.text')}</Text>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable onPress={() => void run()} disabled={pending} style={styles.action}>
        <Text style={styles.actionText}>
          {pending ? t('konto.export.pending') : t('konto.export.aktion')}
        </Text>
      </Pressable>
    </View>
  );
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
