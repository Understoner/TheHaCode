import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';

// Die Bezahlschranke in der Oberflaeche.
//
// WICHTIG: Das hier ist NICHT der Schutz. Der sitzt in der Datenbank, an der
// INSERT-Policy auf exercises (Migration 0007, geprueft in
// 009_save_exercise.test.sql). Diese Komponente sagt dem Nutzer nur vorher,
// was er sonst erst beim Speichern als Fehler erfuehre. Wer sie umgeht,
// bekommt vom Server dieselbe Absage.
//
// Gefragt wird has_plus_access() und nie has_active_subscription (CLAUDE.md
// §Zugriff) - kaeme ein Gutschein oder eine Aktion dazu, aendert sich genau
// jene Datenbankfunktion und hier nichts.
export function PlusGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const access = usePlusAccess();

  if (loading || (session && access.isPending)) return <SkeletonList />;

  if (!session) {
    return (
      <Hinweis titel={t('sequenz.gate.anmeldenTitel')} text={t('sequenz.gate.anmeldenText')}>
        <Link href="/konto" style={styles.link}>
          {t('sequenz.gate.zumKonto')}
        </Link>
      </Hinweis>
    );
  }

  // Ein Fehler beim Abfragen ist kein Freibrief: ohne verlaessliche Auskunft
  // bleibt der Editor zu. Aufmachen waere die falsche Richtung - der Nutzer
  // baute eine Sequenz und liefe beim Speichern in die Wand.
  if (access.isError || access.data !== true) {
    return (
      <Hinweis titel={t('sequenz.gate.plusTitel')} text={t('sequenz.gate.plusText')}>
        <Text style={styles.small}>{t('sequenz.gate.plusHinweis')}</Text>
      </Hinweis>
    );
  }

  return <>{children}</>;
}

function Hinweis({
  titel,
  text,
  children,
}: {
  titel: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{titel}</Text>
      <Text style={styles.body}>{text}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
  },
  small: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
