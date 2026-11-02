import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { QueryBoundary } from '@/components/QueryBoundary';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { displayFont } from '@/design/responsive';
import { useTeamList, type TeamMember } from '@/features/team/useTeamList';
import { supabase } from '@/lib/supabase';

// Das Team im Vorschlag "Mondlicht Mobile" (02.11.2026, nur Testsystem):
// jede Person als ruhige Karte - das Foto rund im Mondhof, Rolle als
// Etikett, der Name in der Ueberschrift-Schrift, die Bio als lesbarer Text
// mit Absaetzen. Kein erfundener Inhalt: nur was in team_members steht.
//
// Im Livesystem bleibt TeamList.tsx.

const PHOTO = 148;

function photoUrlFor(path: string | null) {
  return path ? supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl : null;
}

export function TeamMondlicht() {
  const { t } = useTranslation();
  const query = useTeamList();

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>{t('team.m.lead')}</Text>
      <QueryBoundary query={query} empty={{ title: t('team.empty.title'), hint: t('team.empty.hint') }}>
        {(members) => (
          <View style={styles.list}>
            {members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </View>
        )}
      </QueryBoundary>
    </View>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const palette = useThemePalette();
  const url = photoUrlFor(member.photo_path);
  const paragraphs = (member.bio ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <View style={styles.card}>
      <View style={styles.sky}>
        {/* Mondhof hinter dem Foto, ein paar Sterne - aus der Palette. */}
        <Svg width="100%" height="100%" viewBox="0 0 358 200" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} aria-hidden>
          <Circle cx={179} cy={104} r={98} fill={palette.glow} opacity={0.06} />
          <Circle cx={179} cy={104} r={86} fill={palette.glow} opacity={0.08} />
          {[
            [36, 30, 1.3],
            [70, 150, 1],
            [300, 40, 1.2],
            [326, 140, 1],
            [260, 176, 0.9],
          ].map(([x, y, r]) => (
            <Circle key={`${x}`} cx={x} cy={y} r={r} fill={palette.ink900} opacity={0.7} />
          ))}
          <Path d="M0 186 C 90 176, 270 196, 358 186" fill="none" stroke={palette.glow} strokeOpacity={0.25} strokeWidth={1.5} />
        </Svg>
        <View style={styles.ring}>
          {url ? (
            <Image source={{ uri: url }} style={styles.photo} accessibilityLabel={member.full_name} />
          ) : (
            <View style={[styles.photo, styles.initialWrap]} accessibilityLabel={member.full_name}>
              <Text {...displayFont} style={styles.initial}>
                {member.full_name.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.body}>
        {member.role_title ? <Text style={styles.role}>{member.role_title}</Text> : null}
        <Text role="heading" aria-level={2} style={styles.name}>
          {member.full_name}
        </Text>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.bio}>
            {p}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  lead: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  sky: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oceanImageBg,
  },
  ring: {
    padding: 4,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.ocean700,
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.full,
  },
  initialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  initial: {
    fontSize: 56,
    color: colors.ocean700,
  },
  body: {
    gap: 10,
    padding: 20,
  },
  role: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ocean700,
  },
  name: {
    marginTop: -4,
    fontSize: 26,
    lineHeight: 31,
    color: colors.ink900,
  },
  bio: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
  },
});
