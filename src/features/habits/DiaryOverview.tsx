import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

import { shiftMonth, weekdayIndex, type IsoDate } from './dates';
import { formatDay, formatMonth } from './format';
import { daysDoneThisWeek, monthHeat, streakWithGrace, weekHeat, type HeatDay } from './stats';
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

/** Die laufende Woche: Mo bis So, Serie und freier Tag. */
export function DiaryWeek({
  today,
  logs,
  activeCount,
}: {
  today: IsoDate;
  logs: HabitLog[];
  activeCount: number;
}) {
  const { t } = useTranslation();
  const counts = useCountByDay(logs);
  const doneDays = useMemo(() => new Set(counts.keys()), [counts]);
  const week = weekHeat(today, counts, activeCount);
  const streak = streakWithGrace(doneDays, today);

  return (
    <View style={styles.card}>
      <Text style={styles.big}>
        {t('diary.insights.week', { count: daysDoneThisWeek(doneDays, today) })}
      </Text>
      <DayGrid days={week} today={today} showNumbers />
      <Text style={styles.text}>{t('diary.insights.streak', { count: streak.days })}</Text>
      <Text style={styles.meta}>
        {streak.graceUsedThisWeek ? t('diary.insights.graceUsed') : t('diary.insights.graceOpen')}
      </Text>
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
