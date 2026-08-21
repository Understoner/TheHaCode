import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { PlusPricing } from '@/features/plus/PlusPricing';

// /plus ist die Adresse aus SAD §4.6 - dieselbe, auf die create-checkout bei
// einem Abbruch zurueckschickt.
export default function PlusScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('plus.title')}</Text>
      <PlusPricing />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
});
