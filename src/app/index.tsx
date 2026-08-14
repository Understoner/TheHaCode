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
        <Text style={styles.intro}>{t('home.intro')}</Text>
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
    color: colors.ink900,
  },
  subtitle: {
    fontSize: 16,
    color: colors.ink700,
  },
  // maxWidth begrenzt die Zeilenlaenge: ueber die volle Desktop-Breite gezogen
  // waere der Absatz rund 200 Zeichen breit und damit muehsam zu lesen. 620px
  // ergeben etwa 75 Zeichen pro Zeile. lineHeight grosszuegiger als bei
  // Meta-Text, weil das hier der einzige laengere Fliesstext der Seite ist.
  intro: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink700,
    textAlign: 'center',
    maxWidth: 620,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
});
