import { Link, type Href } from 'expo-router';
import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { useThemeName } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { addDays, today as heute, weekStart, type IsoDate } from '@/features/habits/dates';
import { weekHeat } from '@/features/habits/stats';
import { useHabitLogs, useMyHabits } from '@/features/habits/useHabits';
import { useFavorites } from '@/features/sessions/useFavorites';
import { useSessionsList } from '@/features/sessions/useSessions';
import type { PlayableExercise } from '@/types/breathing';

import { Mandala, MoonPhaseGlyph, RitualGlyph, Stars } from './Ornaments';
import { pickRituals, ritualMinutes } from './rituals';
import { dayTime, impulseIndex, moonPhase } from './today';

// Die Startseite (01.11.2026, nur Testsystem): Impuls des Tages, deine drei
// Rituale, deine Woche. Sie ersetzt im Testsystem die News als Landing Page;
// die News stehen dort unter /news. Gleich aufgebaut in beiden Darstellungen,
// Mondlicht bringt nur Sterne und weichere Formen mit.

/** Die Ueberschrift auf Fraunces setzen (Mondlicht, siehe tokens.ts themeCss). */
const displayFont = { dataSet: { font: 'display' } } as object;

/**
 * Das Datum erst im Browser: die Seite wird zur Bauzeit gerendert, und dort
 * waere es das Datum des Builds.
 */
function useNow(): Date | null {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return hydrated ? new Date() : null;
}

function noSubscription() {
  return () => {};
}

export function StartScreen() {
  const { t } = useTranslation();
  const theme = useThemeName();
  const now = useNow();

  const dateLine = now
    ? `${new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)} · ${t(
        `start.moon.${moonPhase(now)}`,
      )}`
    : ' ';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {theme === 'mondlicht' ? <Stars /> : null}
      <View style={styles.column}>
        <View style={styles.greeting}>
          <View style={styles.greetingText}>
            <Text style={styles.dateLine}>{dateLine}</Text>
            <Text role="heading" aria-level={1} style={styles.title}>
              {now ? t(`start.greeting.${dayTime(now)}`) : t('start.greeting.day')}
            </Text>
          </View>
          <Link href="/einstellungen" aria-label={t('start.settings')} style={styles.settingsLink}>
            <View style={styles.settingsButton}>
              <View style={styles.settingsDot} />
            </View>
          </Link>
        </View>

        <Rituals now={now} />
        <Week />
      </View>
    </ScrollView>
  );
}

function Rituals({ now }: { now: Date | null }) {
  const { t } = useTranslation();
  const sessions = useSessionsList();
  const favorites = useFavorites();

  return (
    <QueryBoundary query={sessions} empty={{ title: t('sessions.empty.title'), hint: t('sessions.empty.hint') }}>
      {(list) => {
        const rituals = pickRituals(list, favorites.ids);
        return (
          <>
            <Impulse now={now} first={rituals[0] ?? null} />
            <View style={styles.section}>
              <Text role="heading" aria-level={2} style={styles.sectionTitle}>
                {t('start.rituals.title')}
              </Text>
              <View style={styles.ritualRow}>
                {rituals.map((exercise, index) => (
                  <RitualTile key={exercise.id} exercise={exercise} index={index} />
                ))}
              </View>
              <Link href="/sessions" style={styles.moreLink}>
                <Text style={styles.moreLinkText}>{t('start.rituals.all')}</Text>
              </Link>
            </View>
          </>
        );
      }}
    </QueryBoundary>
  );
}

function Impulse({ now, first }: { now: Date | null; first: PlayableExercise | null }) {
  const { t } = useTranslation();
  const href: Href = first ? `/sessions/${first.id}` : '/sessions';

  return (
    <View style={styles.impulseCard}>
      <Mandala />
      <Text style={styles.badge}>{t('start.impulse.title')}</Text>
      <Text {...displayFont} style={styles.impulseText}>
        {now ? t(`start.impulse.${impulseIndex(now)}`) : ' '}
      </Text>
      <Link href={href} style={styles.ctaLink}>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>
            {first ? t('start.impulse.start', { title: first.title }) : t('start.impulse.toSessions')}
          </Text>
        </View>
      </Link>
    </View>
  );
}

// Ungleiche Ecken, im Wechsel - wie Kiesel. Gross ist radius.lg, die eine
// spitze Ecke radius.sm.
const TILE_CORNERS = [
  { borderBottomLeftRadius: radius.sm },
  { borderBottomRightRadius: radius.sm },
  { borderTopLeftRadius: radius.sm },
];

function RitualTile({ exercise, index }: { exercise: PlayableExercise; index: number }) {
  const { t } = useTranslation();
  const minutes = ritualMinutes(exercise.estimated_seconds);
  return (
    <Link href={`/sessions/${exercise.id}`} style={styles.tileLink}>
      <View style={[styles.tile, TILE_CORNERS[index % TILE_CORNERS.length]]}>
        <RitualGlyph index={index} />
        <Text style={styles.tileTitle} numberOfLines={3}>
          {exercise.title}
        </Text>
        {minutes ? <Text style={styles.tileMeta}>{t('start.rituals.minutes', { count: minutes })}</Text> : null}
      </View>
    </Link>
  );
}

function Week() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text role="heading" aria-level={2} style={styles.sectionTitle}>
          {t('start.week.title')}
        </Text>
        <Link href="/habit-tracker" style={styles.headLink}>
          <Text style={styles.moreLinkText}>{t('start.week.toDiary')}</Text>
        </Link>
      </View>
      {loading ? null : session ? (
        <WeekMoons />
      ) : (
        <View style={styles.weekCard}>
          <Text style={styles.body}>{t('start.week.signedOut')}</Text>
        </View>
      )}
    </View>
  );
}

function WeekMoons() {
  const { t } = useTranslation();
  const today = heute();
  const monday = weekStart(today);
  const habits = useMyHabits();
  const logs = useHabitLogs(monday, addDays(monday, 6));

  return (
    <QueryBoundary query={habits}>
      {(myHabits) => (
        <QueryBoundary query={logs}>
          {(entries) => <WeekRow today={today} habits={myHabits} entries={entries} t={t} />}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

function WeekRow({
  today,
  habits,
  entries,
  t,
}: {
  today: IsoDate;
  habits: { id: string; is_active: boolean }[];
  entries: { user_habit_id: string; log_date: IsoDate }[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const active = useMemo(() => new Set(habits.filter((h) => h.is_active).map((h) => h.id)), [habits]);
  const counts = useMemo(() => {
    const map = new Map<IsoDate, number>();
    for (const e of entries) if (active.has(e.user_habit_id)) map.set(e.log_date, (map.get(e.log_date) ?? 0) + 1);
    return map;
  }, [entries, active]);
  const days = weekHeat(today, counts, active.size, today);
  const labels = t('start.week.days').split(',');

  return (
    <View style={styles.weekCard}>
      <View style={styles.weekRow}>
        {days.map((day, i) => {
          const isToday = day.date === today;
          const glyph = (
            <View style={styles.weekDay}>
              <MoonPhaseGlyph level={day.level} isFuture={day.isFuture} isToday={isToday} />
              <Text style={[styles.weekLabel, isToday && styles.weekLabelToday]}>{labels[i]}</Text>
            </View>
          );
          if (day.isFuture) return <View key={day.date}>{glyph}</View>;
          return (
            <Link
              key={day.date}
              href={isToday ? '/habit-tracker' : { pathname: '/habit-tracker/tag', params: { datum: day.date } }}
              aria-label={t('start.week.dayLabel', { day: labels[i], done: day.done, total: active.size })}
              style={styles.weekDayLink}
            >
              {glyph}
            </Link>
          );
        })}
      </View>
      <Text style={styles.hint}>{t('start.week.legend')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  column: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  greetingText: {
    flex: 1,
    gap: 6,
  },
  dateLine: {
    fontSize: 15,
    color: colors.ink700,
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '600',
    color: colors.ink900,
  },
  settingsLink: {
    display: 'flex',
  },
  // Ein Rad aus zwei Ringen: Kontur aussen, Punkt innen.
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.ink700,
  },
  impulseCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
    color: colors.ocean700,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  impulseText: {
    maxWidth: 420,
    fontSize: 22,
    lineHeight: 30,
    fontStyle: 'italic',
    color: colors.ink900,
  },
  ctaLink: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    display: 'flex',
  },
  // Lange Sessionnamen umbrechen statt ueber den Rand zu laufen.
  cta: {
    maxWidth: '100%',
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
    justifyContent: 'center',
  },
  ctaText: {
    flexShrink: 1,
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm + 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: colors.ink900,
  },
  ritualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tileLink: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
  },
  tile: {
    flex: 1,
    minHeight: 120,
    padding: 14,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.oceanTint,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tileTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.ink900,
  },
  tileMeta: {
    fontSize: 13,
    color: colors.ink700,
  },
  moreLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    display: 'flex',
    justifyContent: 'center',
  },
  headLink: {
    minHeight: 44,
    display: 'flex',
    justifyContent: 'center',
  },
  moreLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ocean700,
  },
  weekCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDayLink: {
    display: 'flex',
  },
  weekDay: {
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    gap: 6,
  },
  weekLabel: {
    fontSize: 12,
    color: colors.ink700,
  },
  weekLabelToday: {
    color: colors.ink900,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    color: colors.ink700,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
  },
});
