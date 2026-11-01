import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { NewsList } from '@/features/news/NewsList';

// Die News als eigene Seite (01.11.2026): im Testsystem ist "/" die neue
// Startseite, die News ziehen hierher. Im Livesystem ist die Seite zwar
// erreichbar, verlinkt bleibt dort aber "/".
export default function NewsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('news.pageTitle')}
      </Text>
      <NewsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
});
