import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

// Ein "i" neben der Ueberschrift, das eine Bedienungshilfe ueber die Seite
// legt - ohne die Seite zu verlassen.
//
// WARUM EINE UEBERBLENDUNG UND KEINE EIGENE SEITE
// -----------------------------------------------
// Die Hilfe wird gebraucht, waehrend man vor dem Player oder dem Formular
// sitzt. Eine eigene Seite hiesse wegnavigieren und den Stand verlieren - im
// Konfigurator waeren halb ausgefuellte Bloecke weg. Die Ueberblendung laesst
// alles darunter stehen.
//
// WIE SIE SICH SCHLIESST
// ----------------------
// Tippen daneben, der Knopf "Schliessen" oder Escape (react-native-web leitet
// Escape an onRequestClose weiter, am Handy die Zurueck-Geste). Der Hintergrund
// ist ein eigener Pressable HINTER der Karte und nicht ihr Elternteil: so kommt
// ein Tippen in die Karte - etwa beim Scrollen - gar nicht erst beim
// Hintergrund an.
//
// Ohne Einblendanimation: Die Hilfe soll sofort da sein, und eine Bewegung
// mehr braucht niemand, der gerade eine Atemuebung vorbereitet. Nebenbei
// raeumt react-native-web ein animiertes Modal erst nach dem Ende der
// Animation ab - in Tests kommt dieses Ende nie.
//
// Wie der Stern ein Schriftzeichen statt eines Icons: das Projekt hat keine
// Icon-Bibliothek (CLAUDE.md §Stack, siehe FavoriteStar.tsx).

export type HilfeAbschnitt = { titel: string; text: string };

type Props = {
  /** Beschriftung fuer Screenreader - sehend steht dort nur "i". */
  label: string;
  titel: string;
  abschnitte: HilfeAbschnitt[];
};

export function InfoButton({ label, titel, abschnitte }: Props) {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const schliessen = () => setOffen(false);

  return (
    <>
      <PressableRing
        // role ausdruecklich: react-native-web macht aus einem Pressable ein
        // <div> ohne Rolle (siehe FavoriteStar.tsx).
        role="button"
        aria-label={label}
        aria-expanded={offen}
        onPress={() => setOffen(true)}
        style={styles.button}
      >
        <Text style={styles.glyph}>i</Text>
      </PressableRing>

      <Modal visible={offen} transparent animationType="none" onRequestClose={schliessen}>
        <View style={styles.buehne}>
          <Pressable
            testID="info-hintergrund"
            aria-label={t('hilfe.schliessen')}
            onPress={schliessen}
            style={styles.hintergrund}
          />

          {/* Keine eigene Dialogrolle: react-native-web legt um den Inhalt
              eines Modal schon einen Container mit role="dialog" und
              aria-modal. Eine zweite Rolle hier ergaebe zwei verschachtelte
              Dialoge - im Browser nachgesehen. */}
          <View testID="info-karte" style={styles.karte}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.inhalt}>
              <Text role="heading" style={styles.titel}>
                {titel}
              </Text>
              {abschnitte.map((abschnitt) => (
                <View key={abschnitt.titel} style={styles.abschnitt}>
                  <Text style={styles.abschnittTitel}>{abschnitt.titel}</Text>
                  <Text style={styles.text}>{abschnitt.text}</Text>
                </View>
              ))}
            </ScrollView>

            <PressableRing role="button" onPress={schliessen} style={styles.schliessen}>
              <Text style={styles.schliessenText}>{t('hilfe.schliessen')}</Text>
            </PressableRing>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Gleiche Groesse und Form wie der Stern: beide sitzen oft nebeneinander.
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  glyph: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontStyle: 'italic',
    color: colors.ink700,
  },
  buehne: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  // Ausgeschrieben statt StyleSheet.absoluteFillObject - das gibt es in
  // React Native 0.86 nicht mehr.
  hintergrund: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  // Abgegrenzt ueber eine 1-px-Linie, nicht ueber Schatten (CLAUDE.md).
  karte: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  // Ohne flexShrink waechst die ScrollView im Web ueber maxHeight der Karte
  // hinaus, und der Knopf "Schliessen" rutscht aus dem Bild.
  scroll: {
    flexShrink: 1,
  },
  inhalt: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  titel: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink900,
  },
  abschnitt: {
    gap: 4,
  },
  abschnittTitel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink700,
  },
  schliessen: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  schliessenText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
