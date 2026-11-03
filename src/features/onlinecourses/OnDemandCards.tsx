import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useThemePalette } from '@/design/theme';
import { displayFont } from '@/design/responsive';
import { colors, palettes, radius, spacing, type Palette } from '@/design/tokens';
import { Glyph } from '@/features/courses/CourseArt';
import { formatEuro, plusPriceCents, totalMinutes } from './courseLogic';
import { courseHref } from './OnlineCourseView';
import type { OnDemandCourse } from './useOnlineCourses';

// On-Demand-Kurse auf der Kurse-Seite (V1.2, Wunsch des Teams 03.11.2026):
// dieselbe Anatomie wie die Live-Termine (CoursesFeed) - Kachel links, Reihe
// in Farbe, Titel, Zeile mit Eckdaten, Knopf rechts. Statt des
// Kalenderblatts traegt die Kachel ein Abspielzeichen, die Farbe sagt die
// Stufe (Einsteiger, Fortgeschrittene, Experten) wie bei Online Relax oder
// Vor Ort die Reihe.

export const ON_DEMAND_ICON = 'M3 5h18v12H3zM8 21h8M12 17v4M10 8.5v5l4.5-2.5z';

export type CourseLevel = 'einsteiger' | 'fortgeschritten' | 'experten';

export function levelTone(level: string | null, palette: Palette): string {
  const mond = palette === palettes.mondlicht;
  if (level === 'einsteiger') return palette.sage700;
  if (level === 'experten') return mond ? palette.blossom : palette.ink900;
  return palette.ocean700;
}

/** "4 Tage · ca. 22 Min. · Kostenlos" */
function metaLine(course: OnDemandCourse, t: TFunction, hasPlus: boolean): string {
  const minutes = totalMinutes(course.online_course_blocks ?? []);
  const price =
    course.access === 'paid' && course.price_cents
      ? hasPlus
        ? t('onlineCourses.price.plus', { price: formatEuro(plusPriceCents(course.price_cents)) })
        : formatEuro(course.price_cents)
      : course.access === 'plus'
        ? t('onlineCourses.access.plus')
        : t('onlineCourses.feed.free');
  return [
    course.suggested_days ? t('onlineCourses.feed.days', { count: course.suggested_days }) : null,
    minutes > 0 ? t('onlineCourses.feed.minutes', { count: minutes }) : null,
    price,
  ]
    .filter(Boolean)
    .join(' · ');
}

function cta(course: OnDemandCourse, t: TFunction): string {
  if (course.access === 'paid') return t('onlineCourses.feed.cta.paid');
  if (course.access === 'plus') return t('onlineCourses.feed.cta.plus');
  return t('onlineCourses.feed.cta.free');
}

/** Die Reihe in Farbe; kurz fuer die Zeilen, lang fuer die grosse Karte. */
function series(course: OnDemandCourse, t: TFunction, short = false): string {
  const head = short ? t('onlineCourses.feed.monthChip') : t('onlineCourses.feed.onDemand');
  return course.level ? `${head} · ${t(`onlineCourses.level.${course.level}`)}` : head;
}

/** Gross, neben dem naechsten Live-Termin: der hervorgehobene On-Demand-Kurs. */
export function FeaturedOnDemandCard({ course, hasPlus }: { course: OnDemandCourse; hasPlus: boolean }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const tone = levelTone(course.level, palette);

  return (
    <Link href={courseHref(course.slug)} style={styles.cardLink}>
      <View style={[styles.featured, { borderColor: tone }]}>
        <View style={styles.tile}>
          <View style={[styles.tileBand, { backgroundColor: tone }]} />
          <View style={styles.tileBody}>
            <Glyph d={ON_DEMAND_ICON} color={tone} size={28} />
          </View>
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: tone }]}>{`${t('onlineCourses.feed.featured')} · ${series(course, t)}`}</Text>
          <Text {...displayFont} style={styles.featuredTitle}>
            {course.title}
          </Text>
          {/* Ohne Beschreibung: gleich hoch wie der Live-Termin daneben. */}
          <Text style={styles.meta}>{metaLine(course, t, hasPlus)}</Text>
          <View style={styles.foot}>
            <Text style={styles.pill}>{cta(course, t)}</Text>
          </View>
        </View>
      </View>
    </Link>
  );
}

/** Eine Zeile im Block "Online On Demand" - wie CourseRow bei den Live-Terminen. */
export function OnDemandRow({ course, hasPlus }: { course: OnDemandCourse; hasPlus: boolean }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const tone = levelTone(course.level, palette);

  return (
    <Link href={courseHref(course.slug)} style={styles.cardLink}>
      <View style={styles.row}>
        <View style={styles.rowTile}>
          <View style={[styles.rowBand, { backgroundColor: tone }]} />
          <View style={styles.rowTileBody}>
            <Glyph d={ON_DEMAND_ICON} color={tone} size={20} />
          </View>
        </View>
        <View style={styles.text}>
          <View style={styles.series}>
            <Text style={[styles.seriesText, { color: tone }]} numberOfLines={1}>
              {series(course, t, true)}
            </Text>
          </View>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {course.title}
          </Text>
          {course.summary_md ? (
            <Text style={styles.oneLiner} numberOfLines={1}>
              {course.summary_md}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine(course, t, hasPlus)}
          </Text>
        </View>
        <Text style={styles.status}>{cta(course, t)}</Text>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  cardLink: { display: 'flex', flexDirection: 'column', textDecorationLine: 'none' },
  featured: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  tile: {
    width: 64,
    alignSelf: 'flex-start',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.oceanTint,
  },
  tileBand: { height: 20 },
  tileBody: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  featuredTitle: { fontSize: 20, lineHeight: 24, color: colors.ink900 },
  oneLiner: { fontSize: 13, lineHeight: 18, color: colors.ink700 },
  meta: { fontSize: 12, lineHeight: 17, color: colors.ink700 },
  foot: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 6 },
  pill: {
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
  rowTile: { width: 48, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.oceanTint },
  rowBand: { height: 14 },
  rowTileBody: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  series: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seriesText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  rowTitle: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.ink900 },
  status: { fontSize: 12, fontWeight: '800', color: colors.ocean700 },
});
