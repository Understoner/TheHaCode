import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { PageColumn } from '@/design/PageColumn';
import { displayFont, responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { AccessBadge } from './AccessBadge';
import { formatEuro, plusPriceCents } from './courseLogic';
import { useOnlineCourses, type OnlineCourse } from './useOnlineCourses';

// Die Uebersicht der Onlinekurse (V1.2, SAD §11.2). Jeder Kurs sagt, wie er
// zugaenglich ist; ob er fuer DIESE Person offen ist, entscheidet erst die
// Kursseite mit can_open_course().

export const courseHref = (slug: string) => ({ pathname: '/onlinekurse/[slug]' as const, params: { slug } });

export function OnlineCourseCatalog() {
  const { t } = useTranslation();
  const query = useOnlineCourses();
  const plus = usePlusAccess();

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <PageColumn gap={spacing.lg}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>{t('onlineCourses.title')}</Text>
          <Text style={styles.title} role="heading" aria-level={1} {...displayFont}>
            {t('onlineCourses.catalog.title')}
          </Text>
          <Text style={styles.lead}>{t('onlineCourses.catalog.lead')}</Text>
        </View>

        <QueryBoundary
          query={query}
          empty={{ title: t('onlineCourses.catalog.emptyTitle'), hint: t('onlineCourses.catalog.emptyHint') }}
        >
          {(courses) => (
            <View {...responsive('m-grid2')} style={styles.grid}>
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} hasPlus={plus.data === true} />
              ))}
            </View>
          )}
        </QueryBoundary>
      </PageColumn>
    </ScrollView>
  );
}

function CourseCard({ course, hasPlus }: { course: OnlineCourse; hasPlus: boolean }) {
  const { t } = useTranslation();
  const price =
    course.access === 'paid' && course.price_cents
      ? hasPlus
        ? t('onlineCourses.price.plus', { price: formatEuro(plusPriceCents(course.price_cents)) })
        : formatEuro(course.price_cents)
      : null;

  return (
    <Link href={courseHref(course.slug)} style={styles.card}>
      <View style={styles.cardInner}>
        <View style={styles.cardRow}>
          <AccessBadge access={course.access} />
          {price ? <Text style={styles.price}>{price}</Text> : null}
        </View>
        <Text style={styles.cardTitle} {...displayFont}>
          {course.title}
        </Text>
        {course.subtitle ? <Text style={styles.cardSub}>{course.subtitle}</Text> : null}
        {course.summary_md ? <Text style={styles.cardText}>{course.summary_md}</Text> : null}
        <Text style={styles.cardMeta}>
          {course.suggested_days
            ? t('onlineCourses.catalog.meta', { days: course.suggested_days })
            : t('onlineCourses.onDemandShort')}
        </Text>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  head: { gap: spacing.sm },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.sage700,
  },
  title: { fontSize: 30, lineHeight: 38, color: colors.ink900 },
  lead: { fontSize: 16, lineHeight: 24, color: colors.ink700, maxWidth: 620 },
  grid: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  cardInner: { padding: spacing.lg, gap: spacing.sm },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  price: { fontSize: 14, fontWeight: '700', color: colors.ink900 },
  cardTitle: { fontSize: 22, lineHeight: 28, color: colors.ink900 },
  cardSub: { fontSize: 14, color: colors.ink700, fontStyle: 'italic' },
  cardText: { fontSize: 15, lineHeight: 22, color: colors.ink700 },
  cardMeta: { fontSize: 13, color: colors.ink700 },
});
