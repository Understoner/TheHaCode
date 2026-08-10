import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useTeamList } from '@/features/team/useTeamList';
import { supabase } from '@/lib/supabase';

export function TeamList() {
  const { t } = useTranslation();
  const query = useTeamList();

  return (
    <QueryBoundary query={query} empty={{ title: t('team.empty.title'), hint: t('team.empty.hint') }}>
      {(members) => (
        <View style={styles.container}>
          {members.map((member) => {
            const photoUrl = member.photo_path
              ? supabase.storage.from('public-assets').getPublicUrl(member.photo_path).data.publicUrl
              : null;

            return (
              <View key={member.id} style={styles.card}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.photo} accessibilityLabel={member.full_name} />
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
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
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
});
