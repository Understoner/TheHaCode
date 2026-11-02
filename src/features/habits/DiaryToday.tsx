import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { displayFont } from '@/design/responsive';
import { useReduceMotion } from '@/design/useReduceMotion';
import { openExternalUrl } from '@/lib/externalLink';
import { MoonPhaseGlyph } from '@/features/start/Ornaments';

import { weekStart, type IsoDate } from './dates';
import { groupByDayPart, type DayPart } from './dayParts';
import { dayScore } from './dayScore';
import { diaryErrorKey } from './diaryErrors';
import { BOLT_SLUG, HabitEntryRow } from './HabitDay';
import { habitLinkTarget } from './habitLink';
import { weekHeat } from './stats';
import {
  useDeleteLog,
  useSaveLog,
  type HabitCategory,
  type HabitLog,
  type MyHabit,
} from './useHabits';
import { pointsForEntry } from './valuePoints';

// Das Tagebuch "Heute" im Vorschlag "Mondlicht Mobile" (02.11.2026, nur
// Testsystem): oben der Ring mit den Punkten des Tages und die Woche als
// Monde, darunter die Habits nach Tageszeit. Ein Tipp hakt ab - mit kleinem
// Bluetenblatt-Effekt und "+5". Zahlen-Habits haben Plus/Minus und einen
// kleinen Verlauf. Texte und Smileys bleiben bei der bisherigen Zeile
// (HabitEntryRow), ebenso alle Regeln zu Sperre, Plus und Einwilligung -
// gespeichert wird ueber dieselben Hooks wie bisher.

type Props = {
  today: IsoDate;
  habits: MyHabit[];
  allHabits: MyHabit[];
  logs: HabitLog[];
  categories: HabitCategory[];
  plusAccess: boolean;
  scoreOn: boolean;
};

const PART_ICON: Record<DayPart, string> = {
  morgens: 'M12 3v2M5.6 5.6l1.4 1.4M3 12h2M19 12h2M17 7l1.4-1.4M7 16a5 5 0 0 1 10 0M3 19h18',
  tagsueber: 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2',
  abends: 'M17 3a9 9 0 1 0 4 13A7 7 0 0 1 17 3z',
};

// Ungleiche Ecken im Wechsel, wie Kiesel (wie die Ritual-Kacheln der Startseite).
const CORNERS = [
  { borderBottomLeftRadius: radius.sm },
  { borderTopRightRadius: radius.sm },
  { borderTopLeftRadius: radius.sm },
];

export function DiaryToday({ today, habits, allHabits, logs, categories, plusAccess, scoreOn }: Props) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const todays = logs.filter((l) => l.log_date === today);
  const groups = groupByDayPart(habits, (h) => h.habit_templates.day_part);
  const categoryOf = (h: MyHabit) => categories.find((c) => c.id === h.habit_templates.category_id) ?? null;
  const isNegative = (h: MyHabit) => h.habit_templates.is_negative || (categoryOf(h)?.is_negative ?? false);

  // Ring: Anteil der erledigten Habits, die etwas bringen. Abzuege fuellen ihn nicht.
  const positive = habits.filter((h) => !isNegative(h));
  const donePositive = positive.filter((h) => todays.some((l) => l.user_habit_id === h.id)).length;
  const ratio = positive.length > 0 ? donePositive / positive.length : 0;
  const score = useMemo(
    () => (scoreOn ? dayScore(today, allHabits, categories, logs) : null),
    [scoreOn, today, allHabits, categories, logs],
  );

  let index = 0;

  return (
    <View style={styles.stack}>
      <View style={styles.summary}>
        <ScoreRing
          ratio={ratio}
          value={score ? String(score.total) : `${donePositive}/${positive.length}`}
          label={score ? t('diary.today.points') : t('diary.today.done')}
        />
        <WeekMoons today={today} logs={logs} habitCount={habits.length} />
      </View>

      {habits.length === 0 ? (
        <StateMessage title={t('diary.day.empty.title')} body={t('diary.day.empty.hint')} />
      ) : (
        groups.map((group) => (
          <View key={group.part} style={styles.group}>
            <View style={styles.groupHead}>
              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                <Path d={PART_ICON[group.part]} fill="none" stroke={palette.ocean700} strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
              <Text role="heading" aria-level={2} style={styles.groupTitle}>
                {t(`diary.today.part.${group.part}`)}
              </Text>
            </View>
            <View style={styles.rows}>
              {group.items.map((habit) => {
                const corner = CORNERS[index++ % CORNERS.length];
                const log = todays.find((l) => l.user_habit_id === habit.id) ?? null;
                const locked = !habit.habit_templates.is_preview && !plusAccess;
                const type = habit.habit_templates.tracking_type;
                if (type === 'done') {
                  return (
                    <TickRow
                      key={habit.id}
                      habit={habit}
                      date={today}
                      log={log}
                      locked={locked}
                      negative={isNegative(habit)}
                      scoreOn={scoreOn}
                      corner={corner}
                    />
                  );
                }
                if (type === 'number') {
                  return (
                    <NumberRow
                      key={habit.id}
                      habit={habit}
                      date={today}
                      log={log}
                      history={logs}
                      locked={locked}
                      corner={corner}
                    />
                  );
                }
                return (
                  <HabitEntryRow
                    key={habit.id}
                    habit={habit}
                    date={today}
                    log={log}
                    category={categoryOf(habit)}
                    locked={locked}
                    scoreOn={scoreOn}
                  />
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function ScoreRing({ ratio, value, label }: { ratio: number; value: string; label: string }) {
  const palette = useThemePalette();
  const circumference = 2 * Math.PI * 30;
  return (
    <View style={styles.ring}>
      <Svg width={74} height={74} viewBox="0 0 74 74" aria-hidden style={StyleSheet.absoluteFill}>
        <Circle cx={37} cy={37} r={36} fill={palette.glow} fillOpacity={0.06 + 0.14 * ratio} />
        <Circle cx={37} cy={37} r={30} fill="none" stroke={palette.line} strokeWidth={5} />
        {ratio > 0 ? (
          <Circle
            cx={37}
            cy={37}
            r={30}
            fill="none"
            stroke={palette.ocean700}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${(circumference * Math.min(1, ratio)).toFixed(1)} ${circumference.toFixed(1)}`}
            transform="rotate(-90 37 37)"
          />
        ) : null}
      </Svg>
      <Text {...displayFont} style={styles.ringValue}>
        {value}
      </Text>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

function WeekMoons({ today, logs, habitCount }: { today: IsoDate; logs: HabitLog[]; habitCount: number }) {
  const { t } = useTranslation();
  const counts = useMemo(() => {
    const map = new Map<IsoDate, number>();
    for (const l of logs) map.set(l.log_date, (map.get(l.log_date) ?? 0) + 1);
    return map;
  }, [logs]);
  const days = weekHeat(weekStart(today), counts, habitCount, today);
  const labels = t('start.week.days').split(',');

  return (
    <View style={styles.week}>
      {days.map((day, i) => {
        const isToday = day.date === today;
        const glyph = (
          <View style={styles.weekDay}>
            <MoonPhaseGlyph level={day.level} isFuture={day.isFuture} isToday={isToday} size={26} />
            <Text style={[styles.weekLabel, isToday && styles.weekLabelToday]}>{labels[i]}</Text>
          </View>
        );
        if (day.isFuture || isToday) return <View key={day.date}>{glyph}</View>;
        return (
          <Link
            key={day.date}
            href={{ pathname: '/habit-tracker/tag', params: { datum: day.date } }}
            aria-label={t('start.week.dayLabel', { day: labels[i], done: day.done, total: habitCount })}
            style={styles.weekLink}
          >
            {glyph}
          </Link>
        );
      })}
    </View>
  );
}

/**
 * Kleine Aktion im Block des Habits: Session starten oder Messen. Steht seit
 * 03.11.2026 IM Block (Wunsch des Users) - vorher daneben, wo sie wie ein
 * eigenes Element wirkte. Sie ist ein eigener Link neben der Abhak-Flaeche,
 * nicht in ihr: ein Link in einer Checkbox waere ungueltiges Markup.
 */
function SideAction({ habit, date, log, locked }: { habit: MyHabit; date: IsoDate; log: HabitLog | null; locked: boolean }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const template = habit.habit_templates;
  if (locked || log) return null;
  const play = (
    <Svg width={12} height={12} viewBox="0 0 24 24" aria-hidden>
      <Path d="M8 5.5v13l10-6.5z" fill={palette.ocean700} />
    </Svg>
  );
  if (template.slug === BOLT_SLUG) {
    return (
      <Link href={{ pathname: '/habit-tracker/bolt', params: { habit: habit.id, date } }} style={styles.sideLink}>
        {t('diary.entry.measure')}
      </Link>
    );
  }
  if (template.exercise_id) {
    return (
      <Link
        href={`/sessions/${template.exercise_id}`}
        accessibilityLabel={`${template.title}: ${t('diary.entry.start')}`}
        style={styles.sideLink}
      >
        {play} {t('diary.entry.start')}
      </Link>
    );
  }
  // Eigene Habits verknuepfen eine Session ueber link_url (0030).
  const target = habitLinkTarget(template.link_url);
  if (target?.kind === 'app') {
    return (
      <Link href={target.href as never} style={styles.sideLink}>
        {target.isSession ? (
          <>
            {play} {t('diary.entry.start')}
          </>
        ) : (
          t('diary.entry.openLink')
        )}
      </Link>
    );
  }
  if (target) {
    return (
      <PressableRing role="link" onPress={() => openExternalUrl(target.href)} style={styles.sideButton}>
        <Text style={styles.sideButtonText}>{`${t('diary.entry.openLink')} ↗`}</Text>
      </PressableRing>
    );
  }
  return null;
}

function TickRow({
  habit,
  date,
  log,
  locked,
  negative,
  scoreOn,
  corner,
}: {
  habit: MyHabit;
  date: IsoDate;
  log: HabitLog | null;
  locked: boolean;
  negative: boolean;
  scoreOn: boolean;
  corner: object;
}) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const reduce = useReduceMotion();
  const save = useSaveLog();
  const remove = useDeleteLog();
  const template = habit.habit_templates;
  const checked = log !== null;
  const pending = save.isPending || remove.isPending;
  const error = save.error ?? remove.error;
  const [burst] = useState(() => new Animated.Value(1));
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!celebrate) return;
    burst.setValue(0);
    const anim = Animated.timing(burst, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    anim.start(() => setCelebrate(false));
    return () => anim.stop();
  }, [celebrate, burst]);

  const toggle = () => {
    if (checked) {
      remove.mutate({ userHabitId: habit.id, date });
      return;
    }
    save.mutate({ userHabitId: habit.id, date, valueNumeric: 1 });
    // Gefeiert wird nur, was etwas bringt - nicht das ehrliche Eintragen eines Abzugs.
    if (!negative && !reduce) setCelebrate(true);
  };

  const points = scoreOn && template.points > 0 ? `${negative ? '−' : '+'}${template.points}` : null;
  const accent = negative ? colors.danger : colors.ocean700;

  return (
    <View>
      <View
        style={[
          styles.tickBlock,
          corner,
          checked && styles.tickRowOn,
          checked && { borderColor: accent },
          !checked && locked && styles.tickRowLocked,
        ]}
      >
        <PressableRing
          onPress={toggle}
          // Entfernen geht immer - auch gesperrt (SAD §3.10). Neu abhaken nicht.
          disabled={pending || (!checked && locked)}
          role="checkbox"
          aria-checked={checked}
          accessibilityLabel={`${template.title}: ${checked ? t('diary.entry.undo') : t('diary.entry.markDone')}`}
          style={styles.tickRow}
        >
          <View style={[styles.tickCircle, checked && { borderColor: accent, backgroundColor: accent }]}>
            {checked ? (
              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={palette.surface} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            ) : null}
            {celebrate ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.burst,
                  {
                    opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.6] }) }],
                  },
                ]}
              >
                <Svg width={56} height={56} viewBox="-28 -28 56 56" aria-hidden>
                  <G>
                    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                      <Ellipse
                        key={deg}
                        cx={0}
                        cy={-18}
                        rx={3}
                        ry={7}
                        transform={`rotate(${deg})`}
                        fill={i % 3 === 2 ? palette.blossom : palette.glow}
                      />
                    ))}
                  </G>
                </Svg>
              </Animated.View>
            ) : null}
          </View>
          <View style={styles.tickText}>
            <Text style={styles.title}>{template.title}</Text>
            {!checked && locked ? <Text style={styles.meta}>{t('diary.entry.locked')}</Text> : null}
          </View>
          {points ? (
            <View>
              <Text style={[styles.points, negative && styles.pointsNegative]}>{points}</Text>
              {celebrate ? (
                <Animated.Text
                  aria-hidden
                  style={[
                    styles.rise,
                    {
                      opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                      transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }],
                    },
                  ]}
                >
                  {points}
                </Animated.Text>
              ) : null}
            </View>
          ) : null}
        </PressableRing>
        <SideAction habit={habit} date={date} log={log} locked={locked} />
      </View>
      {error ? (
        <Text role="alert" style={styles.error}>
          {t(diaryErrorKey(error))}
        </Text>
      ) : null}
    </View>
  );
}

/** Zahl im deutschen Format, ohne unnoetige Nachkommastellen. */
function formatValue(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

function NumberRow({
  habit,
  date,
  log,
  history,
  locked,
  corner,
}: {
  habit: MyHabit;
  date: IsoDate;
  log: HabitLog | null;
  history: HabitLog[];
  locked: boolean;
  corner: object;
}) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const save = useSaveLog();
  const remove = useDeleteLog();
  const template = habit.habit_templates;
  const pending = save.isPending || remove.isPending;
  const error = save.error ?? remove.error;

  // Bisherige Werte, aelteste zuerst - fuer den Mini-Verlauf und als Startwert.
  const past = useMemo(
    () =>
      history
        .filter((l) => l.user_habit_id === habit.id && l.value_numeric !== null && l.log_date <= date)
        .sort((a, b) => a.log_date.localeCompare(b.log_date))
        .map((l) => Number(l.value_numeric)),
    [history, habit.id, date],
  );
  const step = Number(template.step_value ?? 1) || 1;
  const min = template.min_value === null ? 0 : Number(template.min_value);
  const max = template.max_value === null ? null : Number(template.max_value);
  const start = past[past.length - 1] ?? (template.default_target === null ? min : Number(template.default_target));
  const [value, setValue] = useState(start);
  const clamp = (v: number) => Math.max(min, max === null ? v : Math.min(max, v));
  const unit = template.unit ?? '';
  const result = log ? pointsForEntry(template, log.value_numeric === null ? null : Number(log.value_numeric)) : null;

  return (
    <View>
      <View style={[styles.numberRow, corner]}>
        <View style={styles.tickText}>
          <Text style={styles.title}>{template.title}</Text>
          <Sparkline values={past.slice(-7)} color={palette.sage700} />
          {locked && !log ? <Text style={styles.meta}>{t('diary.entry.locked')}</Text> : null}
          <View style={styles.sideWrap}>
            <SideAction habit={habit} date={date} log={log} locked={locked} />
          </View>
        </View>
        {log ? (
          <View style={styles.stepper}>
            <Text style={styles.stepValue}>
              {log.value_numeric === null ? '' : formatValue(Number(log.value_numeric))}
              <Text style={styles.stepUnit}>{unit ? ` ${unit}` : ''}</Text>
            </Text>
            {result && result.points !== 0 ? (
              <Text style={[styles.points, result.isNegative && styles.pointsNegative]}>
                {`${result.isNegative ? '−' : '+'}${result.points}`}
              </Text>
            ) : null}
            <PressableRing
              onPress={() => remove.mutate({ userHabitId: habit.id, date })}
              disabled={pending}
              accessibilityLabel={t('diary.entry.undo')}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>×</Text>
            </PressableRing>
          </View>
        ) : locked ? null : (
          <View style={styles.stepper}>
            <PressableRing
              onPress={() => setValue((v) => clamp(v - step))}
              accessibilityLabel={t('diary.today.less', { step: formatValue(step), unit })}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>–</Text>
            </PressableRing>
            <Text style={styles.stepValue} aria-live="polite">
              {formatValue(value)}
              <Text style={styles.stepUnit}>{unit ? ` ${unit}` : ''}</Text>
            </Text>
            <PressableRing
              onPress={() => setValue((v) => clamp(v + step))}
              accessibilityLabel={t('diary.today.more', { step: formatValue(step), unit })}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </PressableRing>
            <PressableRing
              onPress={() => save.mutate({ userHabitId: habit.id, date, valueNumeric: value })}
              disabled={pending}
              accessibilityLabel={t('diary.today.save', { title: template.title })}
              style={[styles.stepButton, styles.saveButton]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={palette.surface} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </PressableRing>
          </View>
        )}
      </View>
      {error ? (
        <Text role="alert" style={styles.error}>
          {t(diaryErrorKey(error))}
        </Text>
      ) : null}
    </View>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [2 + (i * 86) / (values.length - 1), 15 - ((v - lo) / span) * 12] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={90} height={18} viewBox="0 0 90 18" aria-hidden style={styles.spark}>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ring: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.ink900,
  },
  ringLabel: {
    fontSize: 10,
    color: colors.ink700,
  },
  week: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLink: {
    display: 'flex',
  },
  weekDay: {
    alignItems: 'center',
    gap: 3,
  },
  weekLabel: {
    fontSize: 10,
    color: colors.ink700,
  },
  weekLabelToday: {
    fontWeight: '800',
    color: colors.ink900,
  },
  group: {
    gap: spacing.sm,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  rows: {
    gap: spacing.sm,
  },
  tickBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.sm,
    paddingRight: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  tickRow: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingLeft: 14,
    paddingRight: 2,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  tickRowOn: {
    backgroundColor: colors.oceanTint,
  },
  tickRowLocked: {
    opacity: 0.85,
  },
  tickCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
    width: 56,
    height: 56,
  },
  tickText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: colors.ink900,
  },
  meta: {
    fontSize: 12,
    color: colors.ink700,
  },
  points: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.sage700,
  },
  pointsNegative: {
    color: colors.danger,
  },
  rise: {
    position: 'absolute',
    right: 0,
    top: -6,
    fontSize: 13,
    fontWeight: '800',
    color: colors.sage700,
  },
  sideButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
  },
  sideButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ocean700,
  },
  sideWrap: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sideLink: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ocean700,
    textDecorationLine: 'none',
  },
  numberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  spark: {
    marginTop: 3,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
  },
  stepButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.ink900,
  },
  stepValue: {
    minWidth: 54,
    textAlign: 'center',
    fontSize: 20,
    color: colors.ink900,
  },
  stepUnit: {
    fontSize: 12,
    color: colors.ink700,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    color: colors.danger,
  },
});
