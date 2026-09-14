import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, spacing } from '@/design/tokens';
import { KonfiguratorHilfe } from '@/features/configurator/KonfiguratorHilfe';
import { PlusGate } from '@/features/configurator/PlusGate';
import { SequenceEditor } from '@/features/configurator/SequenceEditor';
import { useSession } from '@/features/sessions/useSessions';

export default function SequenzBearbeitenScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Dieselbe Abfrage wie im Player: eine Sequenz ist eine Sequenz, ob eigen
  // oder redaktionell. Welche man laden darf, entscheidet RLS - eine fremde
  // liefert schlicht nichts, und QueryBoundary zeigt den Fehlerzustand.
  const query = useSession(id);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/sequenzen" style={styles.back}>
        {`‹ ${t('sequenz.zurueck')}`}
      </Link>
      {/* Die Hilfe steht ausserhalb von PlusGate: lesen darf sie jeder. */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('sequenz.bearbeitenTitel')}</Text>
        <KonfiguratorHilfe />
      </View>

      <PlusGate>
        <QueryBoundary query={query}>
          {(sequence) => <SequenceEditor sequence={sequence} />}
        </QueryBoundary>
      </PlusGate>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
  },
  title: {
    flexShrink: 1,
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
});
