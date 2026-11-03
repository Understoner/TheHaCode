import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';
import { addDays, today as heute } from '@/features/habits/dates';
import { formatPlanDate } from './PlanCourse';
import { usePlanSlots, useRemovePlan, useSavePlan } from './useOnlineCourses';

// "Auf spaeter legen" an einem einzelnen Block (V1.2, Schritt 6): drei
// schnelle Termine statt eines Kalenders. Feiner geht es auf der Seite
// "Einplanen" des Kurses.
export function LaterPicker({ courseId, blockId }: { courseId: string; blockId: string }) {
  const { t } = useTranslation();
  const plan = usePlanSlots(courseId);
  const save = useSavePlan(courseId);
  const remove = useRemovePlan();
  const [open, setOpen] = useState(false);
  const planned = plan.data?.get(blockId) ?? null;
  const today = heute();

  if (planned && !open) {
    return (
      <View style={styles.row}>
        <Text style={styles.planned}>{t('onlineCourses.later.planned', { date: formatPlanDate(planned.planned_on) })}</Text>
        <PressableRing onPress={() => setOpen(true)} style={styles.link}>
          <Text style={styles.linkText}>{t('onlineCourses.later.move')}</Text>
        </PressableRing>
        <PressableRing onPress={() => remove.mutate(blockId)} style={styles.link}>
          <Text style={styles.linkText}>{t('onlineCourses.later.remove')}</Text>
        </PressableRing>
      </View>
    );
  }

  if (!open) {
    return (
      <PressableRing onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>{t('onlineCourses.later.open')}</Text>
      </PressableRing>
    );
  }

  const options: [string, string][] = [
    ['onlineCourses.later.tomorrow', addDays(today, 1)],
    ['onlineCourses.later.dayAfter', addDays(today, 2)],
    ['onlineCourses.later.nextWeek', addDays(today, 7)],
  ];

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{t('onlineCourses.later.when')}</Text>
      <View style={styles.row}>
        {options.map(([key, day]) => (
          <PressableRing
            key={key}
            style={styles.chip}
            onPress={() =>
              save.mutate([{ blockId, plannedOn: day, dayPart: planned?.day_part ?? null }], {
                onSuccess: () => setOpen(false),
              })
            }
          >
            <Text style={styles.chipText}>
              {t(key)} · {formatPlanDate(day)}
            </Text>
          </PressableRing>
        ))}
      </View>
      <Text style={styles.hint}>{t('onlineCourses.plan.noReminder')}</Text>
      {save.isError ? <Text style={styles.error}>{t('onlineCourses.block.saveFailed')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  planned: { fontSize: 14, fontWeight: '600', color: colors.ocean700 },
  link: { paddingVertical: 4 },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.ink700, textDecorationLine: 'underline' },
  trigger: {
    borderWidth: 1,
    borderColor: colors.ocean700,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  triggerText: { fontSize: 14, fontWeight: '700', color: colors.ocean700 },
  box: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink700 },
  chip: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  hint: { fontSize: 13, color: colors.ink700 },
  error: { fontSize: 14, color: colors.danger },
});
