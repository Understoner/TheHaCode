import { Link } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';

import {
  categoryComparison,
  habitConsistency,
  weekdayPattern,
  type AnalysisHabit,
  type AnalysisLog,
} from './analysis';
import { TrendChart, WeekBars } from './charts';
import { toIsoDate, type IsoDate } from './dates';
import {
  activeCategoriesByMonth,
  scoreFor,
  type ActiveHabit,
  type PeriodScore,
  type ScoreCategory,
  type ScoreEntry,
} from './score';
import { minutesPerWeek, movingAverage, trendSummary } from './stats';
import type { ExerciseSession, HabitCategory, HabitLog, MyHabit } from './useHabits';

/** Zeitraum der Kategorie- und Habit-Auswertungen, in Tagen. */
const WINDOW_DAYS = 28;
const PATTERN_WEEKS = 8;

type Props = {
  today: IsoDate;
  habits: MyHabit[];
  logs: HabitLog[];
  sessions: ExerciseSession[];
  categories: HabitCategory[];
  scoreOn: boolean;
};

/**
 * Die Auswertungsseite des Tagebuchs (SAD §3.14, eigene Seite seit
 * 30.10.2026). Gerechnet wird in score.ts, stats.ts und analysis.ts; hier
 * wird nur angeordnet.
 */
export function DiaryInsights({ today, habits, logs, sessions, categories, scoreOn }: Props) {
  const { t } = useTranslation();

  const derived = useMemo(() => {
    const byHabit = new Map(habits.map((h) => [h.id, h]));
    const byCategory = new Map(categories.map((c) => [c.id, c]));

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
    const archivedOn = (h: MyHabit) =>
      h.is_active ? null : h.archived_at ? toIsoDate(new Date(h.archived_at)) : h.started_on;
    const activeHabits: ActiveHabit[] = habits.map((h) => ({
      categoryId: h.habit_templates.category_id,
      startedOn: h.started_on,
      archivedOn: archivedOn(h),
    }));
    const active = activeCategoriesByMonth(activeHabits, entries);

    // Fuer analysis.ts: das Vorzeichen nach derselben Regel wie score.ts -
    // das Habit selbst oder (Altbestand) seine ganze Kategorie.
    const analysisHabits: AnalysisHabit[] = habits.map((h) => ({
      id: h.id,
      categoryId: h.habit_templates.category_id,
      isNegative:
        h.habit_templates.is_negative ||
        (byCategory.get(h.habit_templates.category_id)?.is_negative ?? false),
      isActive: h.is_active,
      startedOn: h.started_on,
    }));
    const analysisLogs: AnalysisLog[] = logs.map((l) => ({ habitId: l.user_habit_id, date: l.log_date }));
    const comparison = categoryComparison(analysisHabits, analysisLogs, today, WINDOW_DAYS);

    return {
      trends,
      minutes: minutesPerWeek(sessions, today, (ts) => toIsoDate(new Date(ts))),
      scores: [
        scoreFor('day', today, scoreCategories, entries, active),
        scoreFor('week', today, scoreCategories, entries, active),
        scoreFor('month', today, scoreCategories, entries, active),
        scoreFor('year', today, scoreCategories, entries, active),
      ],
      // In der Reihenfolge der Redaktion (sort_order), nicht nach Zufall der Map.
      comparison: categories.flatMap((c) => comparison.filter((x) => x.categoryId === c.id)),
      pattern: weekdayPattern(analysisHabits, analysisLogs, today, PATTERN_WEEKS),
      consistency: habitConsistency(analysisHabits, analysisLogs, today, WINDOW_DAYS).flatMap((c) => {
        const habit = byHabit.get(c.habitId);
        if (!habit) return [];
        const isNegative = analysisHabits.find((h) => h.id === c.habitId)?.isNegative ?? false;
        return [{ ...c, habit, isNegative }];
      }),
    };
  }, [logs, habits, sessions, categories, today]);

  const totalMinutes = derived.minutes.reduce((sum, w) => sum + w.minutes, 0);

  return (
    // Jede Auswertung ist eine Karte im Raster: breit nebeneinander, mobil
    // untereinander.
    <View {...responsive('habits-grid')} style={styles.cards}>
      {scoreOn ? (
        <ScorePanel scores={derived.scores} categories={categories} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('diary.score.title')}</Text>
          <Text style={styles.text}>{t('diary.analysis.scoreOff')}</Text>
          <Link href="/habit-tracker/einstellungen" style={styles.link}>
            {t('diary.analysis.toSettings')}
          </Link>
        </View>
      )}

      <CategoryCard comparison={derived.comparison} categories={categories} />
      <WeekdayCard pattern={derived.pattern} />
      <HabitsCard rows={derived.consistency} />

      {derived.trends.map(({ habit, trend, summary }) => {
        const unit = habit.habit_templates.unit ?? '';
        return (
          <View key={habit.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('diary.insights.trend', { title: habit.habit_templates.title })}
            </Text>
            {summary.best === null ? (
              <Text style={styles.text}>{t('diary.insights.trendEmpty')}</Text>
            ) : (
              <>
                <TrendChart points={trend} today={today} title={habit.habit_templates.title} />
                <Text style={styles.text}>{t('diary.insights.best', { value: summary.best, unit })}</Text>
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
        <Text style={styles.meta}>{t('diary.insights.minutesTotal', { minutes: totalMinutes })}</Text>
      </View>
    </View>
  );
}

/** "+3", "−2", "±0" - das Minus als echtes Minuszeichen wie beim BOLT-Verlauf. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0';
}

/** Je Kategorie: erledigt in 4 Wochen, an wie vielen Tagen, und gegen davor. */
function CategoryCard({
  comparison,
  categories,
}: {
  comparison: ReturnType<typeof categoryComparison>;
  categories: HabitCategory[];
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('diary.analysis.categories.title')}</Text>
      {comparison.length === 0 ? (
        <Text style={styles.text}>{t('diary.analysis.empty')}</Text>
      ) : (
        comparison.map(({ categoryId, current, previous }) => {
          const title = categories.find((c) => c.id === categoryId)?.title ?? '';
          const negative = t('diary.analysis.categories.negative', { count: current.negative });
          // Eine Kategorie, in der nur abgezogen wird (etwa Alkohol unter
          // Ernaehrung): "0x erledigt" saehe aus wie ein Versaeumnis. Dann
          // stehen die Abzuege vorne und der Vergleich zaehlt sie.
          const onlyNegative = current.positive === 0 && previous.positive === 0;
          return (
            <View key={categoryId} style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={styles.text}>{title}</Text>
                <Text style={onlyNegative ? styles.scoreNegative : styles.value}>
                  {onlyNegative
                    ? negative
                    : t('diary.analysis.categories.done', { count: current.positive })}
                </Text>
              </View>
              {onlyNegative ? null : <Bar share={current.activeDays / WINDOW_DAYS} />}
              <Text style={styles.meta}>
                {onlyNegative
                  ? t('diary.analysis.categories.change', {
                      change: signed(current.negative - previous.negative),
                    })
                  : [
                      t('diary.analysis.categories.days', {
                        count: current.activeDays,
                        total: WINDOW_DAYS,
                      }),
                      t('diary.analysis.categories.change', {
                        change: signed(current.positive - previous.positive),
                      }),
                      ...(current.negative > 0 ? [negative] : []),
                    ].join(' · ')}
              </Text>
            </View>
          );
        })
      )}
      <Text style={styles.meta}>{t('diary.analysis.categories.explain')}</Text>
    </View>
  );
}

/** Mo bis So: an welchen Wochentagen am meisten erledigt wird. */
function WeekdayCard({ pattern }: { pattern: number[] }) {
  const { t } = useTranslation();
  const short = t('diary.insights.weekdays').split(',');
  const long = t('diary.analysis.weekdays.long').split(',');
  const max = Math.max(...pattern);
  const best = max > 0 ? pattern.indexOf(max) : -1;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('diary.analysis.weekdays.title')}</Text>
      {best < 0 ? (
        <Text style={styles.text}>{t('diary.analysis.empty')}</Text>
      ) : (
        <>
          <View style={styles.columns}>
            {pattern.map((count, i) => (
              <View key={short[i]} style={styles.column}>
                <Text style={styles.columnValue}>{count}</Text>
                <View style={styles.columnTrack}>
                  <View
                    style={[
                      styles.columnFill,
                      i === best && styles.columnFillBest,
                      { height: `${(count / max) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.columnLabel}>{short[i]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.text}>{t('diary.analysis.weekdays.best', { day: long[best] })}</Text>
        </>
      )}
      <Text style={styles.meta}>{t('diary.analysis.weekdays.explain', { weeks: PATTERN_WEEKS })}</Text>
    </View>
  );
}

type HabitRow = ReturnType<typeof habitConsistency>[number] & { habit: MyHabit; isNegative: boolean };

/**
 * Je gewaehltem Habit die letzten 4 Wochen. Habits, die abziehen, lesen sich
 * andersherum: gezaehlt werden die freien Tage, und "frei seit" ersetzt die
 * Serie.
 */
function HabitsCard({ rows }: { rows: HabitRow[] }) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('diary.analysis.habits.title')}</Text>
      {rows.length === 0 ? (
        <Text style={styles.text}>{t('diary.analysis.habits.empty')}</Text>
      ) : (
        rows.map((row) => {
          const free = row.windowDays - row.doneDays;
          return (
            <View key={row.habitId} style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={[styles.text, styles.shrink]} numberOfLines={1}>
                  {row.habit.habit_templates.title}
                </Text>
                <Text style={styles.value}>
                  {row.isNegative
                    ? t('diary.analysis.habits.free', { count: free, total: row.windowDays })
                    : t('diary.analysis.habits.done', { count: row.doneDays, total: row.windowDays })}
                </Text>
              </View>
              <Bar share={(row.isNegative ? free : row.doneDays) / Math.max(1, row.windowDays)} />
              <Text style={styles.meta}>
                {row.isNegative
                  ? row.daysSinceLast === null
                    ? t('diary.analysis.habits.neverInWindow', { total: row.windowDays })
                    : t('diary.analysis.habits.freeSince', { count: row.daysSinceLast })
                  : [
                      // "0 Tage in Folge" liest sich wie ein Vorwurf - dann
                      // steht nur die laengste Serie da.
                      ...(row.currentStreak > 0
                        ? [t('diary.analysis.habits.current', { count: row.currentStreak })]
                        : []),
                      t('diary.analysis.habits.longest', { count: row.longestStreak }),
                    ].join(' · ')}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function Bar({ share }: { share: number }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(1, Math.max(0, share)) * 100}%` }]} />
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
        <View key={score.period} style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.text}>{labels[score.period]}</Text>
            <Text style={score.total < 0 ? styles.scoreNegative : styles.value}>
              {t('diary.score.of', { value: score.total, max: score.maxTotal })}
            </Text>
          </View>
          {score.categories.map((c) => {
            const category = categories.find((cat) => cat.id === c.categoryId);
            const share = c.max > 0 ? Math.min(1, Math.abs(c.value) / c.max) : 0;
            return (
              <View key={c.categoryId} style={styles.barRow}>
                <Text style={styles.barLabel}>{category?.title ?? ''}</Text>
                <View style={[styles.barTrack, styles.shrink]}>
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

const COLUMN_HEIGHT = 80;

const styles = StyleSheet.create({
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
  text: {
    fontSize: 14,
    color: colors.ink700,
  },
  meta: {
    fontSize: 12,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  shrink: {
    flex: 1,
  },
  block: {
    gap: 6,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  value: {
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
  columns: {
    flexDirection: 'row',
    gap: 6,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  columnValue: {
    fontSize: 12,
    color: colors.ink700,
  },
  columnTrack: {
    width: '100%',
    maxWidth: 28,
    height: COLUMN_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  columnFill: {
    width: '100%',
    backgroundColor: colors.ocean500,
  },
  columnFillBest: {
    backgroundColor: colors.ocean700,
  },
  columnLabel: {
    fontSize: 11,
    color: colors.ink700,
  },
});
