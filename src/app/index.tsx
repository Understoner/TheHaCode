import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { NewsList } from '@/features/news/NewsList';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      </View>
      <Text style={styles.sectionTitle}>{t('news.title')}</Text>
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
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text700,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text700,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text700,
    paddingHorizontal: spacing.md,
  },
});
