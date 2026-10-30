import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

import { addDays, shiftMonth, weekdayIndex, weekStart, type IsoDate } from './dates';
import { formatDay, formatMonth, formatShort } from './format';
import { daysDoneThisWeek, monthHeat, weekHeat, type HeatDay } from './stats';
import type { HabitLog } from './useHabits';

// Die beiden Kalenderkarten der Tagebuch-Uebersicht (30.10.2026): die Woche
// ganz oben, der Monat unter den Habits. Beide oeffnen mit einem Klick auf
// einen Tag dessen Seite zum Ansehen und Nachtragen (tag.tsx). Alles, was
// auswertet, steht auf der Auswertungsseite (DiaryInsights.tsx).

function useCountByDay(logs: HabitLog[]) {
  return useMemo(() => {
    const counts = new Map<IsoDate, number>();
    for (const log of logs) counts.set(log.log_date, (counts.get(log.log_date) ?? 0) + 1);
    return counts;
  }, [logs]);
}

/**
 * Eine Woche Mo bis So, anfangs die laufende. Die Pfeile links und rechts
 * blaettern wochenweise (30.10.2026); in die Zukunft geht es nicht.
 */
export function DiaryWeek({
  today,
  week,
  onChangeWeek,
  logs,
  activeCount,
}: {
  today: IsoDate;
  /** Irgendein Tag der angezeigten Woche. */
  week: IsoDate;
  onChangeWeek: (week: IsoDate) => void;
  logs: HabitLog[];
  activeCount: number;
}) {
  const { t } = useTranslation();
  const counts = useCountByDay(logs);
  const doneDays = useMemo(() => new Set(counts.keys()), [counts]);
  const monday = weekStart(week);
  const sunday = addDays(monday, 6);
  const isCurrent = monday >= weekStart(today);
  const days = weekHeat(week, counts, activeCount, today);
  // Gezaehlt wird bis heute bzw. bis zum Sonntag einer frueheren Woche.
  const done = daysDoneThisWeek(doneDays, isCurrent ? today : sunday);

  // Serie und freier Tag standen bis 30.10.2026 darunter - auf Wunsch
  // gestrichen, um auf dem Handy Platz zu sparen.
  return (
    <View style={[styles.card, styles.weekCard]}>
      <Text style={styles.big}>
        {isCurrent
          ? t('diary.insights.week', { count: done })
          : t('diary.insights.weekPast', {
              count: done,
              from: formatShort(monday),
              to: formatShort(sunday),
            })}
      </Text>
      <View style={styles.weekRow}>
        <PressableRing
          onPress={() => onChangeWeek(addDays(monday, -7))}
          accessibilityLabel={t('diary.insights.prevWeek')}
          hitSlop={8}
          style={styles.weekNav}
        >
          <Text style={styles.weekNavText}>‹</Text>
        </PressableRing>
        <View style={styles.grow}>
          <DayGrid days={days} today={today} showNumbers />
        </View>
        <PressableRing
          onPress={() => onChangeWeek(addDays(monday, 7))}
          disabled={isCurrent}
          accessibilityLabel={t('diary.insights.nextWeek')}
          hitSlop={8}
          style={[styles.weekNav, isCurrent && styles.weekNavDisabled]}
        >
          <Text style={[styles.weekNavText, isCurrent && styles.weekNavTextDisabled]}>›</Text>
        </PressableRing>
      </View>
    </View>
  );
}

/** Der Monatskalender mit Blaettern. */
export function DiaryMonth({
  today,
  month,
  onChangeMonth,
  logs,
  activeCount,
}: {
  today: IsoDate;
  month: IsoDate;
  onChangeMonth: (month: IsoDate) => void;
  logs: HabitLog[];
  activeCount: number;
}) {
  const { t } = useTranslation();
  const counts = useCountByDay(logs);
  const heat = monthHeat(month, counts, activeCount, today);

  return (
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
      <DayGrid days={heat} today={today} />
    </View>
  );
}

/**
 * Wochentage als Kopf, darunter die Tage als Farbfelder. Ein Monat beginnt
 * mit Leerfeldern bis zu seinem ersten Wochentag; eine Woche beginnt immer
 * am Montag und braucht keine.
 */
function DayGrid({
  days,
  today,
  showNumbers = false,
}: {
  days: HeatDay[];
  today: IsoDate;
  showNumbers?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const weekdays = t('diary.insights.weekdays').split(',');
  const leading = days.length > 0 ? weekdayIndex(days[0].date) : 0;

  return (
    <View style={styles.grid}>
      {weekdays.map((d) => (
        <Text key={d} style={styles.weekday}>
          {d}
        </Text>
      ))}
      {Array.from({ length: leading }, (_, i) => (
        <View key={`leer-${i}`} style={styles.slot} />
      ))}
      {days.map((day) => {
        const cellStyle = [
          styles.cell,
          styles.dayCell,
          heatStyles[day.level],
          day.date === today && styles.todayCell,
          day.isFuture && styles.futureCell,
        ];
        const label = t('diary.insights.heatLabel', { date: formatDay(day.date), count: day.done });
        return (
          <View key={day.date} style={styles.slot}>
            {/* Zukunft bleibt ein stilles Feld, eintragen geht dort nicht.
                Heute ist anklickbar - sonst waere genau ein Feld ohne
                Reaktion. */}
            {day.isFuture ? (
              <View accessibilityLabel={label} style={cellStyle} />
            ) : (
              <PressableRing
                onPress={() =>
                  router.push({ pathname: '/habit-tracker/tag', params: { datum: day.date } })
                }
                role="link"
                accessibilityLabel={t('diary.insights.openDay', {
                  date: formatDay(day.date),
                  count: day.done,
                })}
                style={cellStyle}
              />
            )}
            {showNumbers ? (
              <Text style={[styles.dayNumber, day.date === today && styles.dayNumberToday]}>
                {Number(day.date.slice(8))}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const CELL = `${100 / 7}%` as const;
const WEEK_NAV = 28;

const heatStyles = StyleSheet.create({
  0: { backgroundColor: colors.background },
  1: { backgroundColor: colors.oceanTint, borderColor: colors.focusRing },
  2: { backgroundColor: colors.focusRing },
  3: { backgroundColor: colors.ocean500 },
  4: { backgroundColor: colors.ocean700 },
});

const styles = StyleSheet.create({
  // So breit wie der Kalender darin (420 plus Rand): am Desktop stuende eine
  // Reihe von Feldern sonst verloren in einer seitenbreiten Karte. Am Handy
  // greift die Grenze nicht.
  card: {
    width: '100%',
    maxWidth: 420 + 2 * spacing.md + 2,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  // Die Pfeile neben der Reihe brauchen 2 x (28 + 4) zusaetzlich, sonst
  // wuerden die Felder schmaler als die im Monat.
  weekCard: {
    maxWidth: 420 + 2 * (WEEK_NAV + 4) + 2 * spacing.md + 2,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  grow: {
    flex: 1,
  },
  weekNav: {
    width: WEEK_NAV,
    height: WEEK_NAV,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ausgegraut wie der Vorwaerts-Pfeil beim Tag (HabitDay): heute ist das
  // Ende, weiter geht es nicht.
  weekNavDisabled: {
    borderColor: colors.background,
    backgroundColor: colors.background,
  },
  weekNavText: {
    fontSize: 16,
    lineHeight: 18,
    color: colors.ink700,
  },
  weekNavTextDisabled: {
    color: colors.ink500,
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
  },
  weekday: {
    width: CELL,
    textAlign: 'center',
    fontSize: 11,
    color: colors.ink700,
    paddingBottom: 4,
  },
  slot: {
    width: CELL,
  },
  cell: {
    width: '100%',
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
  dayNumber: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.ink700,
    paddingTop: 2,
  },
  dayNumberToday: {
    fontWeight: '600',
    color: colors.ink900,
  },
});
