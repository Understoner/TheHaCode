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
        <Text style={styles.intro}>{t('home.intro')}</Text>
      </View>
      {/* Trennung zwischen Begruessung und Inhalt: Weissraum traegt die
          Hauptlast, die Haarlinie setzt nur den Schlusspunkt. Beides sind die
          im Projekt vorgesehenen Mittel — Schatten sind projektweit verboten
          (CLAUDE.md), Abgrenzung laeuft ueber 1-px-Linien und Luft. */}
      <View style={styles.divider} />
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
  // Ohne die Unterzeile "In Entwicklung" traegt der Bereich nur noch zwei
  // Elemente - der Abstand darf dafuer groesser ausfallen, sonst kleben
  // Ueberschrift und Fliesstext aneinander.
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // Haarlinie, so breit wie der Fliesstext darueber - eine ueber die volle
  // Seitenbreite gezogene Linie wuerde die Begruessung zerschneiden statt sie
  // abzuschliessen. Der Weissraum drumherum ist der eigentliche Trenner.
  divider: {
    height: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: colors.line,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
});
