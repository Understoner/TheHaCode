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
                ) : null}
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text700,
  },
  role: {
    fontSize: 14,
    color: colors.text700,
  },
  bio: {
    fontSize: 14,
    color: colors.text700,
  },
});
