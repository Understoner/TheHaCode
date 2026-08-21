import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CoverImage } from '@/components/CoverImage';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { RECENT_ITEMS_COUNT } from '@/design/navigation';
import { responsive } from '@/design/responsive';
import { CourseBooking } from '@/features/courses/CourseBooking';
import { useCourseSeats } from '@/features/courses/useCourseBooking';
import { useCoursesList } from '@/features/courses/useCoursesList';
import { openExternalUrl, safeExternalUrl } from '@/lib/externalLink';

export function CoursesList() {
  const { t } = useTranslation();
  const query = useCoursesList();
  // Die freien Plaetze kommen aus einer eigenen Abfrage: sie aendern sich,
  // waehrend die Kursliste tagelang gleich bleibt, und sie darf auch ohne
  // Anmeldung gestellt werden (course_seats(), Migration 0011). Faellt sie
  // aus, fehlt nur die Platzangabe - buchen laesst sich trotzdem, die
  // verbindliche Zaehlung sitzt ohnehin in der Datenbank.
  const seats = useCourseSeats();
  const seatsLeft = (courseId: string) => seats.data?.get(courseId) ?? null;

  return (
    <QueryBoundary query={query} empty={{ title: t('kurse.empty.title'), hint: t('kurse.empty.hint') }}>
      {(courses) => {
        const recent = courses.slice(0, RECENT_ITEMS_COUNT);
        const older = courses.slice(RECENT_ITEMS_COUNT);

        return (
          <View style={styles.container}>
            {recent.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>{t('kurse.recentTitle')}</Text>
                <View {...responsive('courses-grid')} style={styles.grid}>
                  {recent.map((course, i) => {
                    const signupUrl = safeExternalUrl(course.signup_url);
                    return (
                      <View key={course.id} style={styles.card}>
                        <CoverImage
                          path={course.cover_image_path}
                          label={course.title}
                          tone={i % 2 === 0 ? 'ocean' : 'sage'}
                          style={styles.cover}
                        />
                        <View style={styles.cardBody}>
                          <Text style={styles.title}>{course.title}</Text>
                          <Text style={styles.description}>{course.description}</Text>
                          <View style={styles.metaRow}>
                            {course.location ? <Text style={styles.meta}>{course.location}</Text> : null}
                            {course.price_info ? <Text style={styles.meta}>{course.price_info}</Text> : null}
                          </View>
                          {course.booking_enabled ? (
                            <CourseBooking course={course} seatsLeft={seatsLeft(course.id)} />
                          ) : signupUrl ? (
                            <Button label={t('kurse.signup')} onPress={() => openExternalUrl(signupUrl)} />
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {older.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>{t('kurse.moreTitle')}</Text>
                <View style={styles.list}>
                  {older.map((course) => {
                    const signupUrl = safeExternalUrl(course.signup_url);
                    return (
                      <View key={course.id} style={styles.listRow}>
                        <CoverImage
                          path={course.cover_image_path}
                          label={course.title}
                          tone="sage"
                          style={styles.listCover}
                        />
                        <View style={styles.listText}>
                          <Text style={styles.listTitle}>{course.title}</Text>
                          <View style={styles.metaRow}>
                            {course.location ? <Text style={styles.meta}>{course.location}</Text> : null}
                            {course.price_info ? <Text style={styles.meta}>{course.price_info}</Text> : null}
                          </View>
                          {course.booking_enabled ? (
                            <CourseBooking course={course} seatsLeft={seatsLeft(course.id)} />
                          ) : null}
                        </View>
                        {!course.booking_enabled && signupUrl ? (
                          <Button label={t('kurse.signup')} onPress={() => openExternalUrl(signupUrl)} />
                        ) : null}
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  // Die Desktop-Breite ('courses-grid') steht als Media Query in
  // src/design/responsive.ts - siehe dort, warum nicht mehr in JavaScript.
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
  list: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    // flex-start statt center: mit dem Buchungsblock ist die Textspalte
    // deutlich hoeher als das Bild, und ein mittig schwebendes Vorschaubild
    // saehe daneben aus.
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  listCover: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  listText: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink900,
  },
});
