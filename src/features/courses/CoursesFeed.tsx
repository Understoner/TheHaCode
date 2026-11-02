import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { displayFont } from '@/design/responsive';
import { availabilityOf, formatPrice } from '@/features/courses/booking';
import { courseIconPath, courseTone, Glyph, KIND_ICON } from '@/features/courses/CourseArt';
import {
  COURSE_KINDS,
  courseCalendar,
  courseKind,
  courseShortTitle,
  courseTheme,
  type CourseKind,
} from '@/features/courses/courseFacts';
import { useCourseSeats } from '@/features/courses/useCourseBooking';
import { useCoursesList, type Course } from '@/features/courses/useCoursesList';

// Die Kurse im Vorschlag "Mondlicht Mobile" (02.11.2026, nur Testsystem):
// Einstieg ueber "Wie willst du ueben?" (Online, Vor Ort, Fuer dich), Monate
// als wischbare Leiste statt eigener Filterseite, oben der naechste Termin
// gross mit Kalenderblatt, darunter kompakte Zeilen, "Atmung nach Mass" als
// eigene Karte. Gebucht wird weiter auf der Kursseite (CourseBooking).
//
// Im Livesystem bleibt CoursesList.tsx.

const detailHref = (slug: string) => ({ pathname: '/kurse/[slug]' as const, params: { slug } });

// Mehr Punkte passen nicht in die Zeile; darueber steht nur die Zahl.
const MAX_SEAT_DOTS = 16;

export function CoursesFeed() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const query = useCoursesList();
  const seats = useCourseSeats();
  const [kind, setKind] = useState<CourseKind | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <Text role="heading" aria-level={1} {...displayFont} style={styles.title}>
        {t('kurse.m.title')}
      </Text>

      <View role="radiogroup" aria-label={t('kurse.m.kindLabel')} style={styles.kinds}>
        {COURSE_KINDS.map((k) => {
          const active = kind === k;
          return (
            <PressableRing
              key={k}
              onPress={() => setKind(active ? null : k)}
              role="radio"
              aria-checked={active}
              style={[styles.kind, active && styles.kindActive]}
            >
              <Glyph d={KIND_ICON[k]} color={active ? palette.surface : palette.ink900} size={22} />
              <Text style={[styles.kindText, active && styles.kindTextActive]}>{t(`kurse.m.kind.${k}`)}</Text>
            </PressableRing>
          );
        })}
      </View>

      <QueryBoundary query={query} empty={{ title: t('kurse.empty.title'), hint: t('kurse.empty.hint') }}>
        {(all) => {
          const dated = all.filter((c) => courseKind(c) !== 'mass');
          const forYou = all.filter((c) => courseKind(c) === 'mass');
          const byKind = kind === null || kind === 'mass' ? dated : dated.filter((c) => courseKind(c) === kind);

          // Die Monate kommen aus den Terminen selbst - kein leerer Monat in der Leiste.
          const months: { key: string; label: string }[] = [];
          for (const c of byKind) {
            const cal = courseCalendar(c.starts_at);
            if (cal && !months.some((m) => m.key === cal.monthKey)) months.push({ key: cal.monthKey, label: cal.monthLong });
          }
          const activeMonth = month && months.some((m) => m.key === month) ? month : null;
          const list = kind === 'mass' ? [] : byKind.filter((c) => !activeMonth || courseCalendar(c.starts_at)?.monthKey === activeMonth);
          const [next, ...rest] = list;
          const seatsLeft = (c: Course) => seats.data?.get(c.id) ?? null;

          return (
            <View style={styles.body}>
              {kind !== 'mass' && months.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthRow}
                  accessibilityLabel={t('kurse.m.monthLabel')}
                >
                  {[{ key: null, label: t('kurse.m.allMonths') }, ...months].map((m) => {
                    const active = activeMonth === m.key;
                    return (
                      <PressableRing
                        key={m.key ?? 'alle'}
                        onPress={() => setMonth(m.key)}
                        role="button"
                        aria-pressed={active}
                        style={[styles.month, active && styles.monthActive]}
                      >
                        <Text style={[styles.monthText, active && styles.monthTextActive]}>{m.label}</Text>
                      </PressableRing>
                    );
                  })}
                </ScrollView>
              ) : null}

              {next ? <NextCard course={next} seatsLeft={seatsLeft(next)} /> : null}

              {kind !== 'mass' && list.length === 0 ? (
                <StateMessage title={t('kurse.m.empty.title')} body={t('kurse.m.empty.hint')} />
              ) : null}

              {rest.length > 0 ? (
                <>
                  <View style={styles.listHead}>
                    <Text role="heading" aria-level={2} {...displayFont} style={styles.listTitle}>
                      {activeMonth ? months.find((m) => m.key === activeMonth)?.label : t('kurse.m.more')}
                    </Text>
                    <Text style={styles.count}>{t('kurse.m.count', { count: list.length })}</Text>
                  </View>
                  <View style={styles.rows}>
                    {rest.map((c) => (
                      <CourseRow key={c.id} course={c} seatsLeft={seatsLeft(c)} />
                    ))}
                  </View>
                </>
              ) : null}

              {(kind === null || kind === 'mass') && forYou.length > 0 ? (
                <View style={styles.rows}>
                  {kind === 'mass' ? (
                    <Text role="heading" aria-level={2} {...displayFont} style={styles.listTitle}>
                      {t('kurse.m.forYou')}
                    </Text>
                  ) : null}
                  {forYou.map((c) => (
                    <ForYouCard key={c.id} course={c} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </View>
  );
}

/** Was der Knopf eines Termins sagt: Buchen, Ausgebucht oder die Anmeldung draussen. */
function useStatus(course: Course, seatsLeft: number | null) {
  const { t } = useTranslation();
  if (course.booking_enabled) {
    const availability = availabilityOf(seatsLeft);
    if (availability.soldOut) return { label: t('kurse.buchung.ausgebucht'), muted: true };
    return { label: t('kurse.m.cta.book'), muted: false };
  }
  if (course.signup_url) return { label: `${course.signup_label ?? t('kurse.signup')} ↗`, muted: false };
  return null;
}

function metaLine(course: Course, time: string | null): string {
  const kind = courseKind(course);
  const price = course.price_cents !== null ? formatPrice(course.price_cents) : course.price_info;
  // Online gehoert der Preis dazu; vor Ort steht er bei der VHS und waere als
  // "Gebuehr laut VHS-Programm" zu lang fuer die Zeile.
  return [course.location, time, kind === 'online' ? price : null]
    .filter(Boolean)
    .join(' · ');
}

function NextCard({ course, seatsLeft }: { course: Course; seatsLeft: number | null }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const cal = courseCalendar(course.starts_at);
  const kind = courseKind(course);
  const status = useStatus(course, seatsLeft);
  const availability = availabilityOf(seatsLeft);
  const capacity = course.capacity;
  const showDots = availability.seatsLeft !== null && capacity !== null && capacity <= MAX_SEAT_DOTS;

  return (
    <Link href={detailHref(course.slug)} style={styles.cardLink}>
      <View style={styles.next}>
        {cal ? (
          <View style={styles.sheet}>
            <Text style={styles.sheetMonth}>{cal.monthShort}</Text>
            <Text {...displayFont} style={styles.sheetDay}>
              {cal.day}
            </Text>
            <Text style={styles.sheetWeekday}>{cal.weekday}</Text>
          </View>
        ) : null}
        <View style={styles.nextText}>
          <Text style={styles.nextLabel}>{`${t('kurse.m.next')} · ${t(`kurse.m.kind.${kind}`)}`}</Text>
          <Text {...displayFont} style={styles.nextTitle}>
            {courseShortTitle(course.title)}
          </Text>
          <Text style={styles.meta}>{metaLine(course, cal?.time ?? null)}</Text>
          <View style={styles.nextFoot}>
            {availability.seatsLeft !== null ? (
              <View style={styles.seats} accessibilityLabel={t('kurse.buchung.plaetze', { count: availability.seatsLeft })}>
                {showDots
                  ? Array.from({ length: capacity }, (_, i) => (
                      <View
                        key={i}
                        style={[styles.seat, { backgroundColor: i < capacity - (availability.seatsLeft ?? 0) ? palette.lineStrong : palette.sage700 }]}
                      />
                    ))
                  : null}
                <Text style={styles.seatsText}>
                  {availability.soldOut ? t('kurse.buchung.ausgebucht') : t('kurse.buchung.plaetze', { count: availability.seatsLeft })}
                </Text>
              </View>
            ) : (
              <View />
            )}
            {status ? (
              <Text style={[styles.cta, status.muted && styles.ctaMuted]}>{status.label}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Link>
  );
}

function CourseRow({ course, seatsLeft }: { course: Course; seatsLeft: number | null }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const cal = courseCalendar(course.starts_at);
  const kind = courseKind(course);
  const theme = courseTheme(course.title);
  const tone = courseTone(kind, theme, palette);
  const status = useStatus(course, seatsLeft);
  const series = kind === 'online' && theme ? `${t('kurse.m.kind.online')} · ${t(`kurse.m.theme.${theme}`)}` : t(`kurse.m.kind.${kind}`);

  return (
    <Link href={detailHref(course.slug)} style={styles.cardLink}>
      <View style={styles.row}>
        {cal ? (
          <View style={styles.rowSheet}>
            <Text style={[styles.rowSheetMonth, { backgroundColor: tone }]}>{cal.monthShort}</Text>
            <Text {...displayFont} style={styles.rowSheetDay}>
              {cal.day}
            </Text>
          </View>
        ) : null}
        <View style={styles.rowText}>
          <View style={styles.series}>
            <Glyph d={courseIconPath(kind, theme)} color={tone} size={13} strokeWidth={2} />
            <Text style={[styles.seriesText, { color: tone }]}>{series}</Text>
          </View>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {courseShortTitle(course.title)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine(course, cal?.time ?? null)}
          </Text>
        </View>
        {status ? <Text style={[styles.status, status.muted && styles.statusMuted]}>{status.label}</Text> : null}
      </View>
    </Link>
  );
}

function ForYouCard({ course }: { course: Course }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  return (
    <Link href={detailHref(course.slug)} style={styles.cardLink}>
      <View style={styles.forYou}>
        <View style={styles.forYouIcon}>
          <Glyph d={KIND_ICON.mass} color={palette.blossom} size={20} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{course.title}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {t('kurse.m.forYouText')}
          </Text>
          <Text style={styles.ask}>{`${t('kurse.m.askOffer')} ›`}</Text>
        </View>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  title: {
    paddingHorizontal: spacing.md,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink900,
  },
  kinds: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  kind: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  kindActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
  },
  kindText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink900,
  },
  kindTextActive: {
    color: colors.surface,
  },
  body: {
    gap: spacing.sm,
  },
  monthRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 2,
  },
  month: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  monthActive: {
    borderColor: colors.ink900,
    backgroundColor: colors.ink900,
  },
  monthText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink700,
  },
  monthTextActive: {
    color: colors.background,
  },
  cardLink: {
    display: 'flex',
    flexDirection: 'column',
    marginHorizontal: spacing.md,
    textDecorationLine: 'none',
  },
  next: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.surface,
  },
  sheet: {
    width: 64,
    alignSelf: 'flex-start',
    alignItems: 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.oceanTint,
  },
  sheetMonth: {
    paddingVertical: 3,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.surface,
    backgroundColor: colors.ocean700,
  },
  sheetDay: {
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 30,
    color: colors.ink900,
  },
  sheetWeekday: {
    paddingTop: 2,
    paddingBottom: 6,
    textAlign: 'center',
    fontSize: 11,
    color: colors.ink700,
  },
  nextText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ocean700,
  },
  nextTitle: {
    fontSize: 20,
    lineHeight: 24,
    color: colors.ink900,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  nextFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 6,
  },
  seats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  seat: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  seatsText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '800',
    color: colors.sage700,
  },
  cta: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '800',
    color: colors.surface,
    backgroundColor: colors.ocean700,
  },
  ctaMuted: {
    color: colors.ink700,
    backgroundColor: colors.oceanTint,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 2,
    paddingTop: spacing.sm,
  },
  listTitle: {
    fontSize: 17,
    color: colors.ink900,
    paddingHorizontal: 2,
  },
  count: {
    fontSize: 12,
    color: colors.ink700,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  rowSheet: {
    width: 48,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.oceanTint,
  },
  rowSheetMonth: {
    paddingVertical: 2,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.surface,
  },
  rowSheetDay: {
    paddingTop: 3,
    paddingBottom: 5,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 22,
    color: colors.ink900,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  series: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  seriesText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: colors.ink900,
  },
  status: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ocean700,
  },
  statusMuted: {
    borderColor: colors.lineStrong,
    color: colors.ink700,
  },
  forYou: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  forYouIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
  },
  ask: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ocean700,
  },
});
