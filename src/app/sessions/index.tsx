import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { SessionsList } from '@/features/sessions/SessionsList';

export default function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('sessions.title')}</Text>
      <Text style={styles.intro}>{t('sessions.intro')}</Text>
      <SessionsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
  intro: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
    paddingHorizontal: spacing.md,
    maxWidth: 620,
    marginBottom: spacing.sm,
  },
});
