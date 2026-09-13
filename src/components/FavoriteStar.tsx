import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius } from '@/design/tokens';
import { useFavorites, useToggleFavorite } from '@/features/sessions/useFavorites';

// Der Stern sitzt an jeder Sequenz - an den allgemein bereitgestellten wie an
// den eigenen. Ein Bauteil fuer beide, weil es fuer den Stern keinen
// Unterschied macht (SAD §3.4: eine Sequenz ist eine Sequenz).
//
// WARUM EIN SCHRIFTZEICHEN UND KEIN ICON
// --------------------------------------
// Das Projekt hat keine Icon-Bibliothek, und eine neue Abhaengigkeit fuer ein
// einziges Zeichen waere keine (CLAUDE.md §Stack). ★ und ☆ stehen in jeder
// Systemschrift und tragen den Zustand schon in ihrer Form - der Unterschied
// ist also nicht allein die Farbe, was fuer Farbfehlsichtige der Punkt ist.
//
// OHNE ANMELDUNG
// --------------
// Der Stern verschwindet nicht, er fuehrt zum Konto. Ein ausgeblendeter
// Stern hiesse, dass niemand ohne Konto je erfaehrt, dass es Favoriten gibt;
// ein Stern, der still nichts tut, waere schlimmer. Ein Favorit ist eine
// fachliche Angabe und gehoert damit in die Datenbank, nicht in den Browser
// (CLAUDE.md §Verboten: localStorage fuer fachliche Daten).

export function FavoriteStar({ exerciseId }: { exerciseId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { angemeldet, istFavorit } = useFavorites();
  const toggle = useToggleFavorite();

  const aktiv = angemeldet && istFavorit(exerciseId);

  return (
    <PressableRing
      // role ausdruecklich, wie bei Checkbox und VolumeSlider:
      // react-native-web macht aus einem Pressable ein <div> ohne Rolle, und
      // aria-pressed an einem <div> ohne Rolle wertet kein Screenreader aus -
      // der Schalter waere dann ein Text, den man nicht bedienen kann.
      role="button"
      // aria-pressed statt eines eigenen Zustandstextes: Screenreader sagen
      // damit von sich aus "gedrueckt"/"nicht gedrueckt".
      aria-pressed={aktiv}
      aria-label={
        angemeldet
          ? t(aktiv ? 'favoriten.entfernen' : 'favoriten.setzen')
          : t('favoriten.anmelden')
      }
      onPress={() => {
        if (!angemeldet) {
          router.push('/konto');
          return;
        }
        toggle.mutate({ exerciseId, favorit: !aktiv });
      }}
      style={[styles.button, aktiv && styles.buttonActive]}
    >
      <Text style={[styles.glyph, aktiv && styles.glyphActive]}>{aktiv ? '★' : '☆'}</Text>
    </PressableRing>
  );
}

const styles = StyleSheet.create({
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
  buttonActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  glyph: {
    // Etwas groesser als Fliesstext: das Zeichen ist hier die ganze
    // Beschriftung und traegt keine Worte neben sich.
    fontSize: 20,
    lineHeight: 24,
    color: colors.ink700,
  },
  glyphActive: {
    color: colors.ocean700,
  },
});
