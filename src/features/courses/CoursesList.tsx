import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CoverImage } from '@/components/CoverImage';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useCoursesList } from '@/features/courses/useCoursesList';

export function CoursesList() {
  const { t } = useTranslation();
  const query = useCoursesList();

  return (
    <QueryBoundary query={query} empty={{ title: t('kurse.empty.title'), hint: t('kurse.empty.hint') }}>
      {(courses) => {
        const [featured, ...rest] = courses;

        return (
          <View style={styles.container}>
            {featured ? (
              <View style={styles.featuredCard}>
                <CoverImage
                  path={featured.cover_image_path}
                  label={featured.title}
                  tone="ocean"
                  style={styles.featuredCover}
                />
                <View style={styles.featuredBody}>
                  <Text style={styles.featuredTitle}>{featured.title}</Text>
                  <Text style={styles.description}>{featured.description}</Text>
                  <View style={styles.metaRow}>
                    {featured.location ? <Text style={styles.meta}>{featured.location}</Text> : null}
                    {featured.price_info ? <Text style={styles.meta}>{featured.price_info}</Text> : null}
                  </View>
                  {featured.signup_url ? (
                    <Button label={t('kurse.signup')} onPress={() => Linking.openURL(featured.signup_url!)} />
                  ) : null}
                </View>
              </View>
            ) : null}

            {rest.length > 0 ? (
              <View style={styles.grid}>
                {rest.map((course, i) => (
                  <View key={course.id} style={styles.card}>
                    <CoverImage
                      path={course.cover_image_path}
                      label={course.title}
                      tone={i % 2 === 0 ? 'sage' : 'ocean'}
                      style={styles.cover}
                    />
                    <View style={styles.cardBody}>
                      <Text style={styles.title}>{course.title}</Text>
                      <Text style={styles.description}>{course.description}</Text>
                      <View style={styles.metaRow}>
                        {course.location ? <Text style={styles.meta}>{course.location}</Text> : null}
                        {course.price_info ? <Text style={styles.meta}>{course.price_info}</Text> : null}
                      </View>
                      {course.signup_url ? (
                        <Button label={t('kurse.signup')} onPress={() => Linking.openURL(course.signup_url!)} />
                      ) : null}
                    </View>
                  </View>
                ))}
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
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  featuredCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.focusRing,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  featuredCover: {
    width: '100%',
    aspectRatio: 16 / 7,
  },
  featuredBody: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink900,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  cardBody: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  description: {
    fontSize: 13,
    color: colors.ink700,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontSize: 12,
    color: colors.ink700,
  },
});
