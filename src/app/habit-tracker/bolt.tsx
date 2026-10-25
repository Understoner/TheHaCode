import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { today as heute } from '@/features/habits/dates';
import { diaryErrorKey } from '@/features/habits/diaryErrors';
import { BOLT_SLUG } from '@/features/habits/HabitDay';
import { useMyHabits, useSaveLog, type MyHabit } from '@/features/habits/useHabits';
import { useStopwatch } from '@/features/habits/useStopwatch';

/**
 * BOLT-Messung (Body Oxygen Level Test): nach einem normalen Ausatmen die
 * Nase zuhalten, Sekunden bis zum ersten deutlichen Atemreiz.
 *
 * Gespeichert wird in ganzen Sekunden - genauer kann niemand den "ersten
 * Impuls" bestimmen, und eine Nachkommastelle taeuschte eine Genauigkeit vor,
 * die es nicht gibt. Keine Einordnung des Werts (SAD §5.7).
 */
export default function BoltScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ habit?: string; date?: string }>();
  const myHabits = useMyHabits();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker" style={styles.back}>
        {t('bolt.back')}
      </Link>
      <Text style={styles.title}>{t('bolt.title')}</Text>

      <QueryBoundary query={myHabits}>
        {(habits) => {
          const habit =
            habits.find((h) => h.id === params.habit && h.is_active) ??
            habits.find((h) => h.is_active && h.habit_templates.slug === BOLT_SLUG);
          if (!habit) {
            return <StateMessage title={t('bolt.missing.title')} body={t('bolt.missing.hint')} />;
          }
          return <Measure habit={habit} date={params.date ?? heute()} />;
        }}
      </QueryBoundary>
    </ScrollView>
  );
}

function Measure({ habit, date }: { habit: MyHabit; date: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const watch = useStopwatch();
  const save = useSaveLog();
  const [result, setResult] = useState<number | null>(null);

  const max = habit.habit_templates.max_value ?? 120;
  const shown = result ?? Math.floor(watch.elapsedMs / 1000);

  return (
    <View style={styles.stack}>
      <Text style={styles.steps}>{t('bolt.steps')}</Text>

      <View style={styles.dial}>
        <Text style={styles.seconds}>{shown}</Text>
        <Text style={styles.unit}>{habit.habit_templates.unit ?? ''}</Text>
      </View>

      {result === null ? (
        <PressableRing
          onPress={() => {
            if (watch.running) {
              const ms = watch.stop();
              setResult(Math.min(max, Math.round(ms / 1000)));
            } else {
              watch.start();
            }
          }}
          style={[styles.bigButton, watch.running && styles.bigButtonStop]}
        >
          <Text style={styles.bigButtonText}>{watch.running ? t('bolt.stop') : t('bolt.start')}</Text>
        </PressableRing>
      ) : (
        <View style={styles.stack}>
          <Text style={styles.resultText}>{t('bolt.result', { seconds: result })}</Text>
          {save.isSuccess ? (
            <Text style={styles.saved}>{t('bolt.saved')}</Text>
          ) : (
            <Button
              label={t('bolt.save')}
              disabled={save.isPending}
              onPress={() =>
                save.mutate(
                  { userHabitId: habit.id, date, valueNumeric: result },
                  { onSuccess: () => router.replace('/habit-tracker') },
                )
              }
            />
          )}
          {save.error ? (
            <Text role="alert" style={styles.error}>
              {t(diaryErrorKey(save.error))}
            </Text>
          ) : null}
          <PressableRing
            onPress={() => {
              setResult(null);
              watch.reset();
              save.reset();
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>{t('bolt.again')}</Text>
          </PressableRing>
        </View>
      )}

      <View style={styles.notice}>
        <Text style={styles.noticeText}>{t('bolt.notice')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  stack: {
    gap: spacing.md,
    alignItems: 'center',
  },
  steps: {
    alignSelf: 'stretch',
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
  },
  dial: {
    width: 200,
    height: 200,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seconds: {
    fontSize: 64,
    fontWeight: '600',
    color: colors.ocean700,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 14,
    color: colors.ink700,
  },
  bigButton: {
    minWidth: 160,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  bigButtonStop: {
    backgroundColor: colors.ocean800,
  },
  bigButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.surface,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  saved: {
    fontSize: 15,
    color: colors.sage700,
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    fontSize: 14,
    color: colors.ink700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  notice: {
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSubtle,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
});
