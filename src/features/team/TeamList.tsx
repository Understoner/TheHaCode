import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { RECENT_ITEMS_COUNT } from '@/design/navigation';
import { responsive } from '@/design/responsive';
import { useTeamList } from '@/features/team/useTeamList';
import { supabase } from '@/lib/supabase';

function photoUrlFor(path: string | null) {
  return path ? supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl : null;
}

// Das Portrait sitzt jetzt wie das Cover bei News und Kursen: oben, ueber die
// volle Kartenbreite, quadratisch statt 16:9 - ein Gesicht in einem
// Breitbildausschnitt waere oben und unten abgeschnitten.
//
// Fehlt ein Foto, steht hier bewusst NICHT das Wasserzeichen aus CoverImage
// (Ring und Kreuz): eine Person ist kein Kursbild, und die Silhouette sagt
// ohne Umweg, dass hier ein Portrait fehlt. Die Flaeche, die Tokenfarbe und
// die Rundung sind dieselben.
function TeamPhoto({ url, label, variant }: { url: string | null; label: string; variant: 'card' | 'row' }) {
  const isCard = variant === 'card';
  const frame = isCard ? styles.cover : styles.listCover;

  if (url) {
    // resizeMode "contain" statt des Vorgabewerts "cover": auf dem Handy ist
    // der Rahmen wegen maxHeight breiter als hoch, und "cover" schnitte dann
    // oben und unten ab - also genau dort, wo bei einem Portrait Stirn und
    // Kinn sitzen. "contain" zeigt das Bild immer vollstaendig; was daneben
    // frei bleibt, traegt dieselbe Tonflaeche wie die Silhouette unten, so
    // dass Foto und Platzhalter denselben Grund haben.
    return (
      <Image
        source={{ uri: url }}
        style={[frame, styles.photoTint]}
        resizeMode="contain"
        accessibilityLabel={label}
      />
    );
  }

  return (
    <View style={[frame, styles.photoFallback]} accessibilityLabel={label}>
      <View style={isCard ? styles.avatarHead : styles.listAvatarHead} />
      <View style={isCard ? styles.avatarBody : styles.listAvatarBody} />
    </View>
  );
}

export function TeamList() {
  const { t } = useTranslation();
  const query = useTeamList();

  return (
    <QueryBoundary query={query} empty={{ title: t('team.empty.title'), hint: t('team.empty.hint') }}>
      {(members) => {
        const recent = members.slice(0, RECENT_ITEMS_COUNT);
        const older = members.slice(RECENT_ITEMS_COUNT);

        return (
          <View style={styles.container}>
            {recent.length > 0 ? (
              <View style={styles.section}>
                {/* Kein Abschnittstitel: die Seite heisst schon "Team", und
                    "Team" darunter noch einmal ist eine Zeile ohne Inhalt.
                    Bei News und Kursen ist das anders - dort sagt "Aktuelle
                    Kurse" etwas ueber die Auswahl. Der zweite Abschnitt
                    ("Weiteres Team") behaelt seine Ueberschrift, weil er sich
                    ohne sie nicht vom ersten unterscheiden liesse. */}
                <View {...responsive('team-grid')} style={styles.grid}>
                  {recent.map((member) => (
                    <View key={member.id} style={styles.card}>
                      <TeamPhoto
                        url={photoUrlFor(member.photo_path)}
                        label={member.full_name}
                        variant="card"
                      />
                      <View style={styles.cardBody}>
                        {/* Rolle ueber dem Namen, wie die Kategorie ueber dem
                            Titel eines News-Beitrags: die Einordnung zuerst,
                            dann die Sache selbst. */}
                        {member.role_title ? <Text style={styles.role}>{member.role_title}</Text> : null}
                        <Text style={styles.name}>{member.full_name}</Text>
                        {/* Vier Zeilen wie beim News-Anriss - gleich hohe
                            Karten lesen sich ruhiger als eine Treppe. */}
                        {member.bio ? (
                          <Text style={styles.bio} numberOfLines={4}>
                            {member.bio}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {older.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>{t('team.moreTitle')}</Text>
                <View style={styles.list}>
                  {older.map((member) => (
                    <View key={member.id} style={styles.listRow}>
                      <TeamPhoto
                        url={photoUrlFor(member.photo_path)}
                        label={member.full_name}
                        variant="row"
                      />
                      <View style={styles.listDivider} />
                      <View style={styles.listText}>
                        {member.role_title ? <Text style={styles.listRole}>{member.role_title}</Text> : null}
                        <Text style={styles.listName}>{member.full_name}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  // Gleiche Karte wie die News-Hero-Karte: gerundeter Rahmen, kein Innenrand,
  // das Bild sitzt buendig an drei Kanten (overflow: hidden schneidet es an
  // den Rundungen ab).
  card: {
    flexGrow: 0,
    flexBasis: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  // Die Desktop-Breite ('team-grid') steht als Media Query in
  // src/design/responsive.ts - siehe dort, warum nicht mehr in JavaScript.

  // Quadratisch statt 16:9 - ein Portrait im Breitbildausschnitt verliert
  // Stirn und Kinn. Die Deckelung braucht es trotzdem: auf dem Handy ist die
  // Karte fast fensterbreit, und ein ungedeckeltes Quadrat waere dort ueber
  // 380px hoch - fast doppelt so hoch wie ein News-Cover, eine einzige Karte
  // fuellte den halben Bildschirm. Beschnitten wird deswegen nichts, siehe
  // resizeMode in TeamPhoto.
  cover: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 320,
  },
  cardBody: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  photoTint: {
    backgroundColor: colors.oceanImageBg,
  },
  photoFallback: {
    backgroundColor: colors.oceanImageBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarHead: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.ocean500,
    marginBottom: 8,
  },
  avatarBody: {
    width: 112,
    height: 62,
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
    backgroundColor: colors.ocean500,
  },
  role: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ocean700,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  bio: {
    fontSize: 13,
    color: colors.ink700,
  },
  list: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  listCover: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  // Trennlinie zwischen Bild und Text, wie in den Listenzeilen der News.
  listDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.line,
  },
  listAvatarHead: {
    width: 15,
    height: 15,
    borderRadius: radius.full,
    backgroundColor: colors.ocean500,
    marginBottom: 2,
  },
  listAvatarBody: {
    width: 30,
    height: 17,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: colors.ocean500,
  },
  listText: {
    flex: 1,
    gap: 4,
  },
  listRole: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ocean700,
  },
  listName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink900,
  },
});
