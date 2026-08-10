import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useCoursesList } from '@/features/courses/useCoursesList';
import { supabase } from '@/lib/supabase';

export function CoursesList() {
  const { t } = useTranslation();
  const query = useCoursesList();

  return (
    <QueryBoundary query={query} empty={{ title: t('kurse.empty.title'), hint: t('kurse.empty.hint') }}>
      {(courses) => (
        <View style={styles.container}>
          {courses.map((course) => {
            const coverUrl = course.cover_image_path
              ? supabase.storage.from('public-assets').getPublicUrl(course.cover_image_path).data.publicUrl
              : null;

            return (
              <View key={course.id} style={styles.card}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.cover} accessibilityLabel={course.title} />
                ) : null}
                <View style={styles.content}>
                  <Text style={styles.title}>{course.title}</Text>
                  <Text style={styles.description}>{course.description}</Text>
                  {course.location ? <Text style={styles.meta}>{course.location}</Text> : null}
                  {course.price_info ? <Text style={styles.meta}>{course.price_info}</Text> : null}
                  {course.signup_url ? (
                    <Button label={t('kurse.signup')} onPress={() => Linking.openURL(course.signup_url!)} />
                  ) : null}
                </View>
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.heroSurface,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
  },
  content: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text700,
  },
  description: {
    fontSize: 14,
    color: colors.text700,
  },
  meta: {
    fontSize: 13,
    color: colors.text700,
  },
});
