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
                <Text style={styles.sectionHeading}>{t('team.recentTitle')}</Text>
                <View {...responsive('team-grid')} style={styles.grid}>
                  {recent.map((member) => {
                    const photoUrl = photoUrlFor(member.photo_path);
                    return (
                      <View key={member.id} style={styles.card}>
                        {photoUrl ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={styles.photo}
                            accessibilityLabel={member.full_name}
                          />
                        ) : (
                          <View style={styles.photoFallback} accessibilityLabel={member.full_name}>
                            <View style={styles.avatarHead} />
                            <View style={styles.avatarBody} />
                          </View>
                        )}
                        <Text style={styles.name}>{member.full_name}</Text>
                        {member.role_title ? <Text style={styles.role}>{member.role_title}</Text> : null}
                        {member.bio ? <Text style={styles.bio}>{member.bio}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {older.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>{t('team.moreTitle')}</Text>
                <View style={styles.list}>
                  {older.map((member) => {
                    const photoUrl = photoUrlFor(member.photo_path);
                    return (
                      <View key={member.id} style={styles.listRow}>
                        {photoUrl ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={styles.listPhoto}
                            accessibilityLabel={member.full_name}
                          />
                        ) : (
                          <View style={styles.listPhotoFallback} accessibilityLabel={member.full_name}>
                            <View style={styles.listAvatarHead} />
                            <View style={styles.listAvatarBody} />
                          </View>
                        )}
                        <View style={styles.listText}>
                          <Text style={styles.listName}>{member.full_name}</Text>
                          {member.role_title ? <Text style={styles.role}>{member.role_title}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
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
  card: {
    flexGrow: 0,
    flexBasis: '100%',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  // Die Desktop-Breite ('team-grid') steht als Media Query in
  // src/design/responsive.ts - siehe dort, warum nicht mehr in JavaScript.
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
  },
  photoFallback: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.oceanImageBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarHead: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.ocean500,
    marginBottom: 4,
  },
  avatarBody: {
    width: 60,
    height: 34,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.ocean500,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink900,
  },
  role: {
    fontSize: 13,
    color: colors.ocean700,
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
  listPhoto: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
  },
  listPhotoFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.oceanImageBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    gap: 2,
  },
  listName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink900,
  },
});
