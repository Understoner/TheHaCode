import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';
import { monthDays, shiftMonth, weekdayIndex, type IsoDate } from '@/features/habits/dates';
import { formatMonth } from '@/features/habits/format';

/** Wie ein Tag im Kalender aussieht. */
export type DayMark = {
  /** Wie viele Termine an diesem Tag faellig sind oder ihn abdecken. */
  count: number;
  /** done: alles erfuellt, missed: etwas verpasst, open: noch offen, block: innerhalb eines Blocks. */
  tone: 'done' | 'missed' | 'open' | 'block' | 'none';
};

type Props = {
  startsOn: IsoDate;
  endsOn: IsoDate;
  today: IsoDate;
  markOf: (day: IsoDate) => DayMark;
  selected?: IsoDate | null;
  onPressDay?: (day: IsoDate) => void;
  /** Tage, die sich nicht antippen lassen (etwa vergangene im Editor). */
  isDisabled?: (day: IsoDate) => boolean;
  /** Barrierefreie Beschreibung eines Tages. */
  labelOf?: (day: IsoDate, mark: DayMark) => string;
};

const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const;

/**
 * Der Kalender einer Challenge: alle Monate ihres Zeitraums untereinander,
 * Montag zuerst. Tage ausserhalb der Challenge bleiben leer.
 */
export function ChallengeCalendar({
  startsOn,
  endsOn,
  today,
  markOf,
  selected,
  onPressDay,
  isDisabled,
  labelOf,
}: Props) {
  const { t } = useTranslation();
  const months: IsoDate[] = [];
  for (let m = `${startsOn.slice(0, 7)}-01`; m <= endsOn; m = shiftMonth(m, 1)) months.push(m);

  return (
    <View style={styles.months}>
      {months.map((month) => {
        const days = monthDays(month);
        const lead = weekdayIndex(days[0]);
        const cells: (IsoDate | null)[] = [...Array<null>(lead).fill(null), ...days];
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <View key={month} style={styles.month}>
            <Text style={styles.monthTitle}>{formatMonth(month)}</Text>
            <View style={styles.row}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={styles.weekday}>
                  {t(`challenges.weekday.${d}`)}
                </Text>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, w) => w)
              // Wochen ganz ausserhalb der Challenge nicht zeigen - sonst
              // steht unter dem Monat eine leere Zeile.
              .filter((w) => cells.slice(w * 7, w * 7 + 7).some((d) => d !== null && d >= startsOn && d <= endsOn))
              .map((w) => (
                <View key={w} style={styles.row}>
                  {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
                    if (!day || day < startsOn || day > endsOn) {
                      return <View key={day ?? `leer-${w}-${i}`} style={styles.cell} />;
                    }
                    const mark = markOf(day);
                    const disabled = !onPressDay || (isDisabled?.(day) ?? false);
                    return (
                      <PressableRing
                        key={day}
                        onPress={() => onPressDay?.(day)}
                        disabled={disabled}
                        aria-selected={selected === day}
                        accessibilityLabel={labelOf?.(day, mark) ?? day}
                        style={[
                          styles.cell,
                          styles.day,
                          mark.tone === 'done' && styles.dayDone,
                          mark.tone === 'missed' && styles.dayMissed,
                          mark.tone === 'open' && styles.dayOpen,
                          mark.tone === 'block' && styles.dayBlock,
                          day === today && styles.dayToday,
                          selected === day && styles.daySelected,
                        ]}
                      >
                        <Text style={[styles.dayNumber, mark.tone === 'done' && styles.dayNumberDone]}>
                          {Number(day.slice(8))}
                        </Text>
                        {mark.count > 0 ? (
                          <Text style={[styles.count, mark.tone === 'done' && styles.dayNumberDone]}>{mark.count}</Text>
                        ) : null}
                      </PressableRing>
                    );
                  })}
                </View>
              ))}
          </View>
        );
      })}
    </View>
  );
}

/** Der erste Tag, den ein Editor zeigen soll: heute, wenn er im Zeitraum liegt. */
export function initialDay(startsOn: IsoDate, endsOn: IsoDate, today: IsoDate): IsoDate {
  if (today < startsOn) return startsOn;
  if (today > endsOn) return endsOn;
  return today;
}

const styles = StyleSheet.create({
  months: {
    gap: spacing.lg,
  },
  month: {
    gap: 4,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink900,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 56,
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  // Geplant und offen: deutlich anders als ein freier Tag (Rand und Flaeche).
  dayOpen: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  dayBlock: {
    backgroundColor: colors.oceanImageBg,
    borderColor: colors.focusRing,
  },
  dayDone: {
    backgroundColor: colors.sage700,
    borderColor: colors.sage700,
  },
  dayMissed: {
    borderColor: colors.danger,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: colors.ink900,
  },
  daySelected: {
    borderWidth: 2,
    borderColor: colors.ocean700,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
  },
  dayNumberDone: {
    color: colors.surface,
  },
  count: {
    fontSize: 10,
    color: colors.ink700,
  },
});
