import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LegalPlaceholderBanner } from '@/components/LegalPlaceholderBanner';
import { colors, spacing } from '@/design/tokens';
import { hasLegalPlaceholder } from '@/i18n/legalPlaceholder';

export type LegalSection = {
  title: string;
  lines: string[];
};

export const LEGAL_DOCUMENTS = ['impressum', 'datenschutz', 'agb', 'haftung'] as const;

export type LegalDocumentKey = (typeof LEGAL_DOCUMENTS)[number];

/**
 * Vier Rechtstexte, ein Aufbau.
 *
 * WARUM DIE ABSCHNITTE AUS DEM JSON KOMMEN UND NICHT AUS DEM JSX
 * --------------------------------------------------------------
 * Die AGB allein haben fuenfzehn Abschnitte. Als einzelne Schluessel im JSX
 * waeren das ueber hundert Zeilen Auszeichnung, in denen ein vergessener
 * Abschnitt niemandem auffiele - und jede Textaenderung waere eine Aenderung
 * an zwei Dateien. Hier ist der Text die Datenstruktur: wer eine Klausel
 * ergaenzt, ergaenzt sie in legal.json und sonst nirgends.
 *
 * WARUM DER PLATZHALTER-BANNER HIER SITZT UND NICHT IM SCREEN
 * -----------------------------------------------------------
 * Vorher zaehlte jeder Screen die zu pruefenden Felder von Hand auf. Ein neu
 * hinzugefuegter Platzhalter waere dort schlicht nicht mitgeprueft worden -
 * der Banner haette geschwiegen, obwohl noch "[[TODO" auf der Seite steht.
 * Jetzt wird der gesamte gerenderte Text geprueft, und zwar genau der, der
 * auch angezeigt wird. Vergessen kann man das nicht mehr.
 */
export function LegalDocument({ documentKey }: { documentKey: LegalDocumentKey }) {
  const { t } = useTranslation('legal');

  const sections = t(`${documentKey}.sections`, { returnObjects: true }) as unknown as LegalSection[];
  const stand = t(`${documentKey}.stand`, { defaultValue: '' });

  const allText = sections.flatMap((section) => [section.title, ...section.lines]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LegalPlaceholderBanner active={hasLegalPlaceholder(allText)} />

      <Text style={styles.title}>{t(`${documentKey}.title`)}</Text>
      {stand ? <Text style={styles.stand}>{stand}</Text> : null}

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.lines.map((line) => (
            <Text key={line} style={styles.text}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    // Rechtstexte werden gelesen, nicht ueberflogen. Die Zeilenlaenge bleibt
    // deshalb begrenzt, statt auf breiten Bildschirmen ueber die volle Breite
    // zu laufen.
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  stand: {
    fontSize: 13,
    color: colors.ink700,
    marginTop: -spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
  },
});
