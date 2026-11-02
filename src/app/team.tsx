import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { displayFont } from '@/design/responsive';
import { colors, DESIGN_PREVIEW, spacing } from '@/design/tokens';
import { TeamList } from '@/features/team/TeamList';
import { TeamMondlicht } from '@/features/team/TeamMondlicht';

export default function TeamScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text role="heading" aria-level={1} {...displayFont} style={styles.title}>
        {t('team.title')}
      </Text>
      {/* Im Testsystem im Design des Vorschlags "Mondlicht Mobile" (02.11.2026). */}
      {DESIGN_PREVIEW ? <TeamMondlicht /> : <TeamList />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
});
