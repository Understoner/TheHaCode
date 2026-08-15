import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { MySequencesList } from '@/features/configurator/MySequencesList';
import { PlusGate } from '@/features/configurator/PlusGate';

export default function SequenzenScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('sequenz.title')}</Text>
      <Text style={styles.intro}>{t('sequenz.intro')}</Text>

      <PlusGate>
        <View style={styles.inner}>
          <Link href="/sequenzen/neu" style={styles.newButton}>
            {t('sequenz.neu')}
          </Link>
          <MySequencesList />
        </View>
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
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  intro: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
    maxWidth: 620,
    marginBottom: spacing.sm,
  },
  inner: {
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
  },
  newButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ocean700,
    color: colors.surface,
    fontSize: 15,
    fontWeight: '500',
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
