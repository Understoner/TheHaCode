import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';
import { playlistLinks } from '@/features/sessions/playlists';
import { openExternalUrl } from '@/lib/externalLink';

// Die passende Playlist zur Sequenz - in Spotify oder Apple Music, nicht hier.
//
// WAS DIESE KNOEPFE TUN UND WAS NICHT
// -----------------------------------
// Sie oeffnen eine Adresse, mehr nicht. Die Musik laeuft danach in der App des
// Nutzers weiter, waehrend hier geatmet wird - genau so, wie es im SAD steht:
// Musik bringt der Nutzer in seiner eigenen App mit. Steuern laesst sie sich
// von hier aus nicht, und der Lautstaerkeregler unten gilt weiterhin nur fuer
// die eigene Hintergrundmusik. Beides gleichzeitig anzuschalten ist erlaubt,
// aber selten eine gute Idee - deshalb der Hinweistext.
//
// Die Reihenfolge ist bewusst: zuerst die Playlist starten, dann
// zurueckkommen und die Sequenz starten. Andersherum laeuft die Uhr, waehrend
// man noch in der Musik-App sucht.

export function PlaylistLinks({
  exercise,
}: {
  exercise: { spotify_url: string | null; apple_music_url: string | null };
}) {
  const { t } = useTranslation();
  const links = playlistLinks(exercise);

  // Ohne hinterlegte Playlist erscheint der ganze Abschnitt nicht. Ein leerer
  // Bereich mit Ueberschrift waere ein Versprechen ohne Inhalt.
  if (links.length === 0) return null;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t('playlist.label')}</Text>
      <View style={styles.choices}>
        {links.map(({ provider, url }) => (
          <PressableRing
            key={provider}
            onPress={() => openExternalUrl(url)}
            // role ausdruecklich: react-native-web macht aus einem Pressable
            // ein <div> ohne Rolle (siehe FavoriteStar.tsx).
            role="button"
            // Dass der Link die Seite verlaesst, gehoert in die Beschriftung
            // fuer Screenreader - sehend sieht man es am Dienstnamen.
            aria-label={t('playlist.oeffnen', { dienst: t(`playlist.${provider}`) })}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{t(`playlist.${provider}`)}</Text>
          </PressableRing>
        ))}
      </View>
      <Text style={styles.hint}>{t('playlist.hinweis')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 620,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink700,
    textAlign: 'center',
    maxWidth: 360,
  },
});
