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
  // Seit dem 06.09.2026 steht hier nur noch der Name. Der Einleitungsabsatz
  // ist weg, und zwar nicht aus Platznot allein: er sagte dasselbe wie der
  // erste News-Beitrag, nur kuerzer. Zweimal dieselbe Auskunft
  // uebereinandergestapelt kostet auf dem Handy den halben ersten Bildschirm -
  // und der gehoert den News.
  //
  // Ohne den Absatz braucht der Bereich auch keinen Innenabstand mehr: gap
  // trennte zwei Elemente, jetzt ist es eines.
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
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
    // Enger als vorher: der Abstand war auf einen Absatz darueber bemessen,
    // jetzt steht dort eine einzelne Zeile.
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
});
