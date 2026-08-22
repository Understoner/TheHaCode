import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CoverImage } from '@/components/CoverImage';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { CourseBooking } from '@/features/courses/CourseBooking';
import { formatCourseStart } from '@/features/courses/schedule';
import { useCourse } from '@/features/courses/useCourse';
import { useCourseSeats } from '@/features/courses/useCourseBooking';
import type { Course } from '@/features/courses/useCoursesList';
// Derselbe Leser wie bei den News. Er liegt dort, weil er dort entstanden ist,
// und wird hier mitbenutzt statt kopiert - ein zweiter Markdown-Leser waere
// ein zweiter Ort, an dem dieselben Fehler auftreten.
import { Markdown } from '@/features/news/Markdown';
import { openExternalUrl, safeExternalUrl } from '@/lib/externalLink';

// Die Detailseite zu einem Kurs.
//
// Der Anlass: auf /kurse stand der ganze Kurstext in der Kachel, fuenf Kurse
// ergaben eine Textwand, und wer den dritten Kurs suchte, scrollte durch die
// ersten beiden. Seitdem traegt die Kachel die Kurzfassung (description) und
// diese Seite den Langtext (body_md) - dieselbe Aufteilung wie bei News
// zwischen excerpt und body_md.
export default function KursDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useCourse(slug);

  return (
    <QueryBoundary query={query}>
      {(course) => (course ? <CourseDetail course={course} /> : <NotFound />)}
    </QueryBoundary>
  );
}

function NotFound() {
  const { t } = useTranslation();

  return (
    <View style={styles.notFound}>
      <StateMessage title={t('kurse.detail.notFound.title')} body={t('kurse.detail.notFound.hint')} />
      <Link href="/kurse" style={styles.back}>
        {t('kurse.detail.back')}
      </Link>
    </View>
  );
}

function CourseDetail({ course }: { course: Course }) {
  const { t } = useTranslation();
  // Wie in der Liste: die freien Plaetze kommen aus einer eigenen Abfrage.
  // Faellt sie aus, fehlt nur die Platzangabe - die verbindliche Zaehlung
  // sitzt in der Datenbank.
  const seats = useCourseSeats();
  const signupUrl = safeExternalUrl(course.signup_url);
  const start = formatCourseStart(course.starts_at);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/kurse" style={styles.back}>
        {t('kurse.detail.back')}
      </Link>

      <CoverImage path={course.cover_image_path} label={course.title} tone="sage" style={styles.cover} />

      <View style={styles.metaRow}>
        {start ? <Text style={styles.metaStrong}>{start}</Text> : null}
        {course.location ? <Text style={styles.meta}>{course.location}</Text> : null}
        {course.price_info ? <Text style={styles.meta}>{course.price_info}</Text> : null}
      </View>

      <Text style={styles.title} role="heading" aria-level={1}>
        {course.title}
      </Text>

      {/* Die Kurzfassung steht auch hier, als Vorspann: sie ist der Satz, mit
          dem der Kurs auf der Uebersicht geworben hat, und wer geklickt hat,
          sucht ihn zuerst. */}
      <Text style={styles.lead}>{course.description}</Text>

      {course.body_md ? (
        <>
          <View style={styles.rule} />
          <Markdown source={course.body_md} />
        </>
      ) : null}

      <View style={styles.rule} />

      {course.booking_enabled ? (
        <CourseBooking course={course} seatsLeft={seats.data?.get(course.id) ?? null} />
      ) : signupUrl ? (
        <View style={styles.signup}>
          <Button label={t('kurse.signup')} onPress={() => openExternalUrl(signupUrl)} />
        </View>
      ) : null}

      <Link href="/kurse" style={styles.back}>
        {t('kurse.detail.back')}
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    // Wie bei den News: Fliesstext braucht eine lesbare Zeilenlaenge.
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  notFound: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  back: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ocean700,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaStrong: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
  },
  meta: {
    fontSize: 13,
    color: colors.ink700,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600',
    color: colors.ink900,
  },
  lead: {
    fontSize: 18,
    lineHeight: 30,
    color: colors.ink700,
  },
  rule: {
    height: 1,
    backgroundColor: colors.line,
  },
  signup: {
    alignItems: 'flex-start',
  },
});
