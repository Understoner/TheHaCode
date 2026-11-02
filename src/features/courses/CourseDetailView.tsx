import { Link } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { displayFont } from '@/design/responsive';
import { formatPrice } from '@/features/courses/booking';
import { CourseScene, courseIconPath, courseTone, Glyph, KIND_ICON } from '@/features/courses/CourseArt';
import { CourseBooking } from '@/features/courses/CourseBooking';
import {
  courseCalendar,
  courseEvenings,
  courseKind,
  courseSections,
  courseShortTitle,
  courseTheme,
  isEveningsSection,
  shortEvening,
  type CourseEvenings,
} from '@/features/courses/courseFacts';
import { useCourseSeats } from '@/features/courses/useCourseBooking';
import type { Course } from '@/features/courses/useCoursesList';
import { Markdown } from '@/features/news/Markdown';
import { openExternalUrl, safeExternalUrl } from '@/lib/externalLink';

// Die Kursseite im Vorschlag "Mondlicht Mobile" (03.11.2026, nur
// Testsystem): gezeichnetes Bild statt Foto, Eckdaten als Kacheln, die Abende
// als Zeitleiste mit Monden, Texte aufklappbar, Preis und Knopf immer unten.
//
// Gebucht wird mit derselben CourseBooking wie bisher (AGB-Haken, Gast oder
// Konto, Stripe). Der Knopf unten fuehrt nur dorthin - an der Buchung selbst
// aendert sich nichts.
//
// Im Livesystem bleibt die bisherige Seite in app/kurse/[slug].tsx.

const BOTTOM_BAR = 92;
const HERO = 196;

export function CourseDetailView({ course }: { course: Course }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const seats = useCourseSeats();
  const scroll = useRef<ScrollView>(null);
  const [bookingY, setBookingY] = useState<number | null>(null);

  const kind = courseKind(course);
  const theme = courseTheme(course.title);
  const tone = courseTone(kind, theme, palette);
  const cal = courseCalendar(course.starts_at);
  const sections = courseSections(course.body_md, t('kurse.m.about'));
  const evenings = courseEvenings(sections);
  const texts = sections.filter((s) => !(evenings && isEveningsSection(s)));
  const signupUrl = safeExternalUrl(course.signup_url);
  const price = course.price_cents !== null ? formatPrice(course.price_cents) : course.price_info;

  const pill =
    kind === 'online' && theme
      ? `${t('kurse.m.kind.online')} · ${t(`kurse.m.theme.${theme}`)}`
      : t(`kurse.m.kind.${kind}`);

  // Was der Knopf unten tut: zur Buchung scrollen, die Anmeldung draussen
  // oeffnen oder - bei "Atmung nach Mass" - die Anfrage-Mail.
  const actionLabel = course.booking_enabled
    ? t('kurse.m.toBooking')
    : signupUrl
      ? `${course.signup_label ?? (kind === 'mass' ? t('kurse.m.ask') : t('kurse.signup'))} ↗`
      : null;
  const onAction = () => {
    if (course.booking_enabled) {
      scroll.current?.scrollTo({ y: Math.max(0, HERO + (bookingY ?? 0) - spacing.md), animated: true });
    } else if (signupUrl) {
      openExternalUrl(signupUrl);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <CourseScene style={StyleSheet.absoluteFill} />
          <Link href="/kurse" aria-label={t('kurse.detail.back')} style={styles.back}>
            <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
              <Path d="M15 5l-7 7 7 7" fill="none" stroke={palette.ink900} strokeWidth={1.9} strokeLinecap="round" />
            </Svg>
          </Link>
          <View style={styles.pill}>
            <Glyph d={kind === 'online' ? courseIconPath(kind, theme) : KIND_ICON[kind]} color={tone} size={14} strokeWidth={2} />
            <Text style={[styles.pillText, { color: tone }]}>{pill}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.head}>
            <Text role="heading" aria-level={1} {...displayFont} style={styles.title}>
              {courseShortTitle(course.title)}
            </Text>
            <Text style={styles.lead}>{course.description}</Text>
          </View>

          {kind !== 'mass' ? (
            <View style={styles.tiles}>
              <Tile
                icon={<Glyph d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" color={palette.ocean700} size={18} strokeWidth={2} />}
                value={
                  evenings
                    ? t('kurse.m.evenings', { count: evenings.dates.length })
                    : cal
                      ? `${cal.weekday}, ${cal.day}. ${cal.monthShort.charAt(0)}${cal.monthShort.slice(1).toLowerCase()}`
                      : '–'
                }
                label={evenings && cal ? t('kurse.m.fromDate', { date: `${cal.day}. ${cal.monthLong}` }) : t('kurse.m.date')}
              />
              <Tile
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
                    <Circle cx={12} cy={12} r={9} fill="none" stroke={palette.ocean700} strokeWidth={2} />
                    <Path d="M12 7v5l3 2" fill="none" stroke={palette.ocean700} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                }
                value={evenings?.from ?? cal?.time ?? '–'}
                label={evenings?.to ? t('kurse.m.until', { time: evenings.to }) : t('kurse.m.time')}
              />
              <Tile
                icon={<Glyph d={KIND_ICON[kind === 'online' ? 'online' : 'vorort']} color={palette.ocean700} size={18} strokeWidth={2} />}
                value={course.location ?? '–'}
                label={kind === 'online' ? t('kurse.m.onlineHint') : t('kurse.m.place')}
              />
            </View>
          ) : null}

          {evenings ? <Evenings evenings={evenings} /> : null}

          <Sections sections={texts} />

          {course.booking_enabled ? (
            <View
              style={styles.booking}
              onLayout={(e) => setBookingY(e.nativeEvent.layout.y)}
            >
              <Text role="heading" aria-level={2} style={styles.bookingTitle}>
                {t('kurse.m.bookingTitle')}
              </Text>
              <CourseBooking course={course} seatsLeft={seats.data?.get(course.id) ?? null} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {actionLabel || price ? (
        <View style={styles.bottomBar}>
          {price ? (
            <View style={styles.price}>
              <Text style={styles.priceLabel}>{t('kurse.m.price')}</Text>
              <Text style={styles.priceValue} numberOfLines={2}>
                {price}
              </Text>
            </View>
          ) : null}
          {actionLabel ? (
            <PressableRing onPress={onAction} role={course.booking_enabled ? 'button' : 'link'} style={styles.action}>
              <Text style={styles.actionText}>{actionLabel}</Text>
            </PressableRing>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Tile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={styles.tile}>
      {icon}
      <Text style={styles.tileValue} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** Mond in der Phase p (0..1, 1 = voll) als Pfad um den Mittelpunkt 0/0. */
function moonPath(p: number, r: number): string {
  if (p >= 0.99) return `M0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  const rx = r * Math.abs(1 - 2 * p);
  return `M0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${p < 0.5 ? 0 : 1} 0 ${-r} Z`;
}

/** Die Abende als Zeitleiste: der Mond waechst von Abend zu Abend. */
function Evenings({ evenings }: { evenings: CourseEvenings }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const n = evenings.dates.length;
  return (
    <View>
      <Text style={styles.kicker}>{t('kurse.m.yourEvenings')}</Text>
      <View role="list" style={styles.timeline}>
        {evenings.dates.map((label, i) => (
          <View key={label} role="listitem" style={styles.evening}>
            <View
              aria-hidden
              style={[styles.line, i === 0 && styles.lineFirst, i === n - 1 && styles.lineLast]}
            />
            <Svg width={26} height={26} viewBox="-13 -13 26 26" aria-hidden>
              <Circle r={11} fill={palette.line} />
              <Path d={moonPath((i + 1) / n, 11)} fill={palette.glow} />
            </Svg>
            <Text style={styles.eveningLabel}>{shortEvening(label)}</Text>
            <Text style={styles.eveningNr}>{t('kurse.m.eveningNr', { nr: i + 1, count: n })}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Sections({ sections }: { sections: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.title ?? null);
  if (sections.length === 0) return null;
  return (
    <View style={styles.sections}>
      {sections.map((s) => {
        const isOpen = open === s.title;
        return (
          <View key={s.title} style={styles.section}>
            <PressableRing
              onPress={() => setOpen(isOpen ? null : s.title)}
              role="button"
              aria-expanded={isOpen}
              style={styles.sectionHead}
            >
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text aria-hidden style={styles.sectionSign}>
                {isOpen ? '–' : '+'}
              </Text>
            </PressableRing>
            {isOpen ? (
              <View style={styles.sectionBody}>
                <Markdown source={s.body} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: BOTTOM_BAR + spacing.lg,
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    maxWidth: 760,
    height: HERO,
  },
  back: {
    position: 'absolute',
    left: 12,
    top: 14,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.overlaySurface,
  },
  pill: {
    position: 'absolute',
    left: spacing.md,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingLeft: 7,
    paddingRight: 10,
    borderRadius: radius.full,
    backgroundColor: colors.overlaySurface,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  body: {
    width: '100%',
    maxWidth: 680,
    paddingTop: spacing.md,
    paddingHorizontal: 20,
    gap: 14,
  },
  head: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.ink900,
  },
  lead: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  tileValue: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  tileLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.ink700,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  timeline: {
    marginTop: spacing.sm,
  },
  evening: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
  },
  line: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.line,
  },
  lineFirst: {
    top: '50%',
  },
  lineLast: {
    bottom: '50%',
  },
  eveningLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink900,
  },
  eveningNr: {
    fontSize: 12,
    color: colors.ink700,
  },
  sections: {
    gap: spacing.sm,
  },
  section: {
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  sectionHead: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 14,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink900,
  },
  sectionSign: {
    fontSize: 18,
    color: colors.ink700,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  booking: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.surface,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink900,
  },
  bottomBar: {
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: spacing.md,
    paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' as unknown as number,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  price: {
    flexShrink: 1,
    maxWidth: 150,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  priceValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.ink900,
  },
  action: {
    flex: 1,
    maxWidth: 420,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  actionText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.surface,
  },
});
