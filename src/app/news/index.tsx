import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, DESIGN_PREVIEW, spacing } from '@/design/tokens';
import { PageColumn } from '@/design/PageColumn';
import { NewsFeed } from '@/features/news/NewsFeed';
import { NewsList } from '@/features/news/NewsList';

// Die News als eigene Seite (01.11.2026): im Testsystem ist "/" die neue
// Startseite, die News ziehen hierher. Im Livesystem ist die Seite zwar
// erreichbar, verlinkt bleibt dort aber "/".
export default function NewsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Column>
        <Text role="heading" aria-level={1} style={styles.title}>
          {t('news.pageTitle')}
        </Text>
        {/* Im Testsystem die News des Vorschlags "Mondlicht Mobile" (02.11.2026). */}
        {DESIGN_PREVIEW ? <NewsFeed /> : <NewsList />}
      </Column>
    </ScrollView>
  );
}

// Im Testsystem steht alles in der zentrierten Seitenspalte (PageColumn,
// 02.11.2026), im Livesystem bleibt die Seite wie bisher.
function Column({ children }: { children: ReactNode }) {
  return DESIGN_PREVIEW ? <PageColumn gap={spacing.lg}>{children}</PageColumn> : <>{children}</>;
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
