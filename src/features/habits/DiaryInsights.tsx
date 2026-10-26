import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';

import { TrendChart, WeekBars } from './charts';
import { shiftMonth, toIsoDate, weekdayIndex, type IsoDate } from './dates';
import { formatDay, formatMonth } from './format';
import {
  activeCategoriesByMonth,
  scoreFor,
  type ActiveHabit,
  type PeriodScore,
  type ScoreCategory,
  type ScoreEntry,
} from './score';
import {
  daysDoneThisWeek,
  minutesPerWeek,
  monthHeat,
  movingAverage,
  streakWithGrace,
  trendSummary,
} from './stats';
import type { ExerciseSession, HabitCategory, HabitLog, MyHabit } from './useHabits';

type Props = {
  today: IsoDate;
  month: IsoDate;
  onChangeMonth: (month: IsoDate) => void;
  habits: MyHabit[];
  logs: HabitLog[];
  sessions: ExerciseSession[];
  categories: HabitCategory[];
  scoreOn: boolean;
};

/** Auswertungen und Score (SAD §3.14). Gerechnet wird in stats.ts und score.ts. */
export function DiaryInsights({
  today,
  month,
  onChangeMonth,
  habits,
  logs,
  sessions,
  categories,
  scoreOn,
}: Props) {
  const { t } = useTranslation();
  const activeCount = habits.filter((h) => h.is_active).length;

  const derived = useMemo(() => {
    const doneDays = new Set(logs.map((l) => l.log_date));
    const countByDay = new Map<IsoDate, number>();
    for (const log of logs) countByDay.set(log.log_date, (countByDay.get(log.log_date) ?? 0) + 1);

    const byHabit = new Map(habits.map((h) => [h.id, h]));

    // Verlaeufe fuer Zahlen-Habits, die heute gewaehlt sind (BOLT).
    const trends = habits
      .filter((h) => h.is_active && h.habit_templates.tracking_type === 'number')
      .map((h) => {
        const points = logs
          .filter((l) => l.user_habit_id === h.id && l.value_numeric !== null)
          .map((l) => ({ date: l.log_date, value: Number(l.value_numeric) }));
        return { habit: h, trend: movingAverage(points), summary: trendSummary(points) };
      });

    const scoreCategories: ScoreCategory[] = categories.map((c) => ({
      id: c.id,
      isNegative: c.is_negative,
      maxPerDay: c.max_per_day,
      maxPerWeek: c.max_per_week,
      maxPerMonth: c.max_per_month,
    }));
    const entries: ScoreEntry[] = logs.flatMap((l) => {
      const habit = byHabit.get(l.user_habit_id);
      if (!habit) return [];
      return [
        {
          categoryId: habit.habit_templates.category_id,
          points: habit.habit_templates.points,
          isNegative: habit.habit_templates.is_negative,
          date: l.log_date,
        },
      ];
    });

    // Nur Kategorien, die im jeweiligen Monat aktiv verwendet wurden, zaehlen
    // in Score und Maximum (score.ts). Auch herausgenommene Habits gehoeren
    // dazu - fuer die Monate, in denen sie gewaehlt waren.
    const activeHabits: ActiveHabit[] = habits.map((h) => ({
      categoryId: h.habit_templates.category_id,
      startedOn: h.started_on,
      archivedOn: h.is_active ? null : h.archived_at ? toIsoDate(new Date(h.archived_at)) : h.started_on,
    }));
    const active = activeCategoriesByMonth(activeHabits, entries);

    return {
      week: daysDoneThisWeek(doneDays, today),
      streak: streakWithGrace(doneDays, today),
      heat: monthHeat(month, countByDay, activeCount, today),
      trends,
      minutes: minutesPerWeek(sessions, today, (ts) => toIsoDate(new Date(ts))),
      scores: [
        scoreFor('day', today, scoreCategories, entries, active),
        scoreFor('week', today, scoreCategories, entries, active),
        scoreFor('month', today, scoreCategories, entries, active),
        scoreFor('year', today, scoreCategories, entries, active),
      ],
    };
  }, [logs, habits, sessions, categories, today, month, activeCount]);

  const leading = derived.heat.length > 0 ? weekdayIndex(derived.heat[0].date) : 0;
  const weekdays = t('diary.insights.weekdays').split(',');
  const totalMinutes = derived.minutes.reduce((sum, w) => sum + w.minutes, 0);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('diary.insights.title')}</Text>

      {/* Jede Auswertung ist eine Karte im Raster (26.10.2026): breit
          nebeneinander, mobil untereinander wie bisher. */}
      <View {...responsive('habits-grid')} style={styles.cards}>
        {scoreOn ? <ScorePanel scores={derived.scores} categories={categories} /> : null}

        <View style={styles.card}>
          <Text style={styles.big}>{t('diary.insights.week', { count: derived.week })}</Text>
          <Text style={styles.text}>
            {t('diary.insights.streak', { count: derived.streak.days })}
          </Text>
          <Text style={styles.meta}>
            {derived.streak.graceUsedThisWeek
              ? t('diary.insights.graceUsed')
              : t('diary.insights.graceOpen')}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.monthNav}>
            <PressableRing
              onPress={() => onChangeMonth(shiftMonth(month, -1))}
              accessibilityLabel={t('diary.insights.prevMonth')}
              style={styles.navButton}
            >
              <Text style={styles.navText}>‹</Text>
            </PressableRing>
            <Text style={styles.cardTitle}>{formatMonth(month)}</Text>
            <PressableRing
              onPress={() => onChangeMonth(shiftMonth(month, 1))}
              disabled={month.slice(0, 7) >= today.slice(0, 7)}
              accessibilityLabel={t('diary.insights.nextMonth')}
              style={styles.navButton}
            >
              <Text style={styles.navText}>›</Text>
            </PressableRing>
          </View>
          <View style={styles.grid}>
            {weekdays.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <View key={`leer-${i}`} style={styles.cell} />
            ))}
            {derived.heat.map((day) => (
              <View
                key={day.date}
                accessibilityLabel={t('diary.insights.heatLabel', {
                  date: formatDay(day.date),
                  count: day.done,
                })}
                style={[
                  styles.cell,
                  styles.dayCell,
                  heatStyles[day.level],
                  day.date === today && styles.todayCell,
                  day.isFuture && styles.futureCell,
                ]}
              />
            ))}
          </View>
        </View>

        {derived.trends.map(({ habit, trend, summary }) => {
          const unit = habit.habit_templates.unit ?? '';
          return (
            <View key={habit.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {t('diary.insights.trend', {
                  title: habit.habit_templates.title,
                })}
              </Text>
              {summary.best === null ? (
                <Text style={styles.text}>{t('diary.insights.trendEmpty')}</Text>
              ) : (
                <>
                  <TrendChart points={trend} today={today} title={habit.habit_templates.title} />
                  <Text style={styles.text}>
                    {t('diary.insights.best', { value: summary.best, unit })}
                  </Text>
                  {summary.change !== null && trend.length > 1 ? (
                    <Text style={styles.text}>
                      {t('diary.insights.change', {
                        sign: summary.change > 0 ? '+' : summary.change < 0 ? '−' : '±',
                        value: Math.abs(summary.change),
                        unit,
                      })}
                    </Text>
                  ) : null}
                  <Text style={styles.meta}>{t('diary.insights.average')}</Text>
                </>
              )}
            </View>
          );
        })}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('diary.insights.minutes')}</Text>
          <WeekBars weeks={derived.minutes} title={t('diary.insights.minutes')} />
          <Text style={styles.meta}>
            {t('diary.insights.minutesTotal', { minutes: totalMinutes })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ScorePanel({ scores, categories }: { scores: PeriodScore[]; categories: HabitCategory[] }) {
  const { t } = useTranslation();
  const labels = {
    day: t('diary.score.day'),
    week: t('diary.score.week'),
    month: t('diary.score.month'),
    year: t('diary.score.year'),
  } as const;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('diary.score.title')}</Text>
      {scores.map((score) => (
        <View key={score.period} style={styles.scoreBlock}>
          <View style={styles.scoreHead}>
            <Text style={styles.text}>{labels[score.period]}</Text>
            <Text style={score.total < 0 ? styles.scoreNegative : styles.scoreValue}>
              {t('diary.score.of', { value: score.total, max: score.maxTotal })}
            </Text>
          </View>
          {score.categories.map((c) => {
            const category = categories.find((cat) => cat.id === c.categoryId);
            const share = c.max > 0 ? Math.min(1, Math.abs(c.value) / c.max) : 0;
            return (
              <View key={c.categoryId} style={styles.barRow}>
                <Text style={styles.barLabel}>{category?.title ?? ''}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      // Seit 0028 kann jede Kategorie ins Minus gehen - die
                      // Farbe folgt dem Wert, nicht der Kategorie.
                      c.value < 0 && styles.barFillNegative,
                      { width: `${share * 100}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.meta}>{t('diary.score.explain')}</Text>
    </View>
  );
}

const CELL = `${100 / 7}%` as const;

const heatStyles = StyleSheet.create({
  0: { backgroundColor: colors.background },
  1: { backgroundColor: colors.oceanTint, borderColor: colors.focusRing },
  2: { backgroundColor: colors.focusRing },
  3: { backgroundColor: colors.ocean500 },
  4: { backgroundColor: colors.ocean700 },
});

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink900,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexBasis: '100%',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  big: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ocean700,
  },
  text: {
    fontSize: 14,
    color: colors.ink700,
  },
  meta: {
    fontSize: 12,
    color: colors.ink700,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 18,
    color: colors.ink700,
  },
  // Am Desktop wuerden die Felder sonst handtellergross.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  weekday: {
    width: CELL,
    textAlign: 'center',
    fontSize: 11,
    color: colors.ink700,
    paddingBottom: 4,
  },
  cell: {
    width: CELL,
    aspectRatio: 1,
    padding: 2,
  },
  dayCell: {
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  todayCell: {
    borderColor: colors.ocean700,
  },
  futureCell: {
    backgroundColor: colors.surface,
  },
  scoreBlock: {
    gap: 6,
  },
  scoreHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  scoreNegative: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    width: 90,
    fontSize: 12,
    color: colors.ink700,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.sage500,
  },
  barFillNegative: {
    backgroundColor: colors.danger,
  },
});
