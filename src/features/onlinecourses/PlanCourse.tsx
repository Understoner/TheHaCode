import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { PageColumn } from '@/design/PageColumn';
import { displayFont, responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { addDays, fromIsoDate, today as heute, type IsoDate } from '@/features/habits/dates';
import { KindIcon } from './KindIcon';
import { orderBlocks, planDates, type DayPart, type Weekday } from './courseLogic';
import { courseHref } from './OnlineCourseView';
import { useCanOpenCourse, useCourseProgress, useSavePlan, type CourseWithBlocks } from './useOnlineCourses';

// Einen Onlinekurs im Tagebuch einplanen (V1.2, Schritt 6, Migration 0044).
//
// Die Termine stehen danach im Tagebuch und auf der Kursseite. Es gibt keine
// Erinnerung per Mail oder Push (CLAUDE.md) - das sagt die Seite auch.

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const DAY_PARTS: DayPart[] = ['morgens', 'tagsueber', 'abends'];

function nextMonday(day: IsoDate): IsoDate {
  const weekday = (fromIsoDate(day).getDay() + 6) % 7;
  return addDays(day, 7 - weekday);
}

export function formatPlanDate(iso: IsoDate): string {
  return fromIsoDate(iso).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function PlanCourse({ data }: { data: CourseWithBlocks }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { course } = data;
  const blocks = orderBlocks(data.blocks);
  const { session } = useAuth();
  const open = useCanOpenCourse(course.id);
  const progress = useCourseProgress(course.id);
  const save = useSavePlan(course.id);

  const today = heute();
  const [start, setStart] = useState<IsoDate>(addDays(today, 1));
  const [mode, setMode] = useState<'course' | 'weekdays'>('course');
  const [weekdays, setWeekdays] = useState<Weekday[]>([0, 2, 4]);
  const [dayPart, setDayPart] = useState<DayPart>('abends');
  const [shift, setShift] = useState<Record<string, number>>({});

  const dates = useMemo(() => {
    const base = planDates(
      orderBlocks(data.blocks),
      start,
      mode === 'course' ? { mode } : { mode, weekdays },
      progress.data ?? new Set<string>(),
    );
    for (const [id, iso] of base) if (shift[id]) base.set(id, addDays(iso, shift[id]));
    return base;
  }, [data.blocks, start, mode, weekdays, progress.data, shift]);

  if (!session) {
    return <StateMessage title={t('onlineCourses.plan.loginTitle')} body={t('onlineCourses.plan.loginHint')} />;
  }
  if (open.data === false) {
    return <StateMessage title={t('onlineCourses.plan.lockedTitle')} body={t('onlineCourses.block.lockedHint')} />;
  }

  const startOptions: [string, IsoDate][] = [
    ['onlineCourses.plan.today', today],
    ['onlineCourses.plan.tomorrow', addDays(today, 1)],
    ['onlineCourses.plan.nextMonday', nextMonday(today)],
  ];

  const submit = () =>
    save.mutate(
      [...dates.entries()].map(([blockId, plannedOn]) => ({ blockId, plannedOn, dayPart })),
      { onSuccess: () => router.push('/habit-tracker') },
    );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <PageColumn gap={spacing.lg}>
        <Link href={courseHref(course.slug)} style={styles.back}>
          {t('onlineCourses.block.back', { title: course.title })}
        </Link>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>{t('onlineCourses.plan.eyebrow')}</Text>
          <Text style={styles.title} role="heading" aria-level={1} {...displayFont}>
            {t('onlineCourses.plan.title')}
          </Text>
        </View>

        <View {...responsive('m-split')} style={styles.split}>
          <View style={styles.panel}>
            <Text style={styles.label}>{t('onlineCourses.plan.start')}</Text>
            <View style={styles.chips}>
              {startOptions.map(([key, day]) => (
                <Chip key={key} active={start === day} onPress={() => setStart(day)} label={t(key)} />
              ))}
            </View>

            <Text style={styles.label}>{t('onlineCourses.plan.rhythm')}</Text>
            <View style={styles.chips}>
              <Chip active={mode === 'course'} onPress={() => setMode('course')} label={t('onlineCourses.plan.asCourse')} />
              <Chip active={mode === 'weekdays'} onPress={() => setMode('weekdays')} label={t('onlineCourses.plan.weekdays')} />
            </View>
            {mode === 'weekdays' ? (
              <View style={styles.chips}>
                {WEEKDAYS.map((d) => (
                  <Chip
                    key={d}
                    small
                    active={weekdays.includes(d)}
                    onPress={() =>
                      setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort() as Weekday[]))
                    }
                    label={t(`onlineCourses.plan.wd.${d}`)}
                  />
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>{t('onlineCourses.plan.dayPart')}</Text>
            <View style={styles.chips}>
              {DAY_PARTS.map((p) => (
                <Chip key={p} active={dayPart === p} onPress={() => setDayPart(p)} label={t(`diary.today.part.${p}`)} />
              ))}
            </View>
            <Text style={styles.hint}>{t('onlineCourses.plan.noReminder')}</Text>
          </View>

          <View style={styles.preview}>
            <Text style={styles.section} {...displayFont}>
              {t('onlineCourses.plan.preview', { count: dates.size })}
            </Text>
            {blocks.map((b) => {
              const date = dates.get(b.id);
              return (
                <View key={b.id} style={styles.row}>
                  <KindIcon kind={b.kind} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{b.title}</Text>
                    <Text style={styles.rowMeta}>{date ? formatPlanDate(date) : t('onlineCourses.plan.alreadyDone')}</Text>
                  </View>
                  {date ? (
                    <View style={styles.shift}>
                      <PressableRing
                        style={styles.shiftBtn}
                        aria-label={t('onlineCourses.plan.earlier', { title: b.title })}
                        disabled={date <= today}
                        onPress={() => setShift((s) => ({ ...s, [b.id]: (s[b.id] ?? 0) - 1 }))}
                      >
                        <Text style={styles.shiftText}>−</Text>
                      </PressableRing>
                      <PressableRing
                        style={styles.shiftBtn}
                        aria-label={t('onlineCourses.plan.later', { title: b.title })}
                        onPress={() => setShift((s) => ({ ...s, [b.id]: (s[b.id] ?? 0) + 1 }))}
                      >
                        <Text style={styles.shiftText}>+</Text>
                      </PressableRing>
                    </View>
                  ) : null}
                </View>
              );
            })}
            <Button
              label={save.isPending ? t('onlineCourses.block.saving') : t('onlineCourses.plan.save', { count: dates.size })}
              disabled={save.isPending || dates.size === 0}
              onPress={submit}
            />
            {save.isError ? <Text style={styles.error}>{t('onlineCourses.block.saveFailed')}</Text> : null}
          </View>
        </View>
      </PageColumn>
    </ScrollView>
  );
}

function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return (
    <PressableRing
      onPress={onPress}
      role="button"
      aria-pressed={active}
      style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableRing>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  back: { fontSize: 15, fontWeight: '600', color: colors.ocean700 },
  head: { gap: spacing.sm },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.sage700 },
  title: { fontSize: 30, lineHeight: 38, color: colors.ink900 },
  split: { gap: spacing.xl },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink700, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSmall: { paddingHorizontal: 0, width: 44, alignItems: 'center' },
  chipActive: { backgroundColor: colors.ocean700, borderColor: colors.ocean700 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink700 },
  chipTextActive: { color: colors.surface },
  hint: { fontSize: 13, lineHeight: 19, color: colors.ink700, marginTop: spacing.sm },
  preview: { gap: spacing.sm, flexShrink: 1 },
  section: { fontSize: 20, color: colors.ink900 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 13, color: colors.ink700 },
  shift: { flexDirection: 'row', gap: 6 },
  shiftBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftText: { fontSize: 18, fontWeight: '700', color: colors.ink900 },
  error: { fontSize: 14, color: colors.danger },
});
