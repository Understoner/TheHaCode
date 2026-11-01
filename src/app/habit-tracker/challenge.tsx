import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { useAuth } from '@/features/auth/AuthProvider';
import { ChallengeCalendar, initialDay, type DayMark } from '@/features/challenges/ChallengeCalendar';
import { describePlan } from '@/features/challenges/describePlan';
import { page } from '@/features/challenges/pageStyles';
import {
  parsePlan,
  phaseOf,
  progressOf,
  slotStatus,
  type ChallengeEntry,
  type SlotStatus,
} from '@/features/challenges/plan';
import {
  challengeErrorKey,
  useCancelChallenge,
  useDeleteChallenge,
  useMyChallenges,
  type Challenge,
} from '@/features/challenges/useChallenges';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { today as heute, type IsoDate } from '@/features/habits/dates';
import { formatDay, formatShort } from '@/features/habits/format';
import { HabitEntryRow } from '@/features/habits/HabitDay';
import {
  useHabitCatalog,
  useHabitLogs,
  useHabitScoreEnabled,
  type HabitCategory,
  type HabitLog,
  type MyHabit,
} from '@/features/habits/useHabits';

/**
 * Das Tracking einer Challenge (0036): Fortschritt, Kalender und die Termine
 * des gewaehlten Tages zum Abhaken. Abhaken ist derselbe Eintrag wie im
 * Tagebuch - die Challenge hat keine eigenen Haken.
 */
export default function ChallengeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={page.container}>
      <Link href="/habit-tracker/challenges" style={page.back}>
        {t('challenges.back')}
      </Link>
      {loading ? (
        <SkeletonList />
      ) : session && id ? (
        <ChallengeLoader id={id} />
      ) : (
        <StateMessage title={t('challenges.missing.title')} body={t('challenges.missing.text')} />
      )}
    </ScrollView>
  );
}

function ChallengeLoader({ id }: { id: string }) {
  const { t } = useTranslation();
  const challenges = useMyChallenges();
  const catalog = useHabitCatalog();
  const plus = usePlusAccess();

  return (
    <QueryBoundary query={challenges}>
      {(list) => {
        const challenge = list.find((c) => c.id === id);
        if (!challenge) {
          return <StateMessage title={t('challenges.missing.title')} body={t('challenges.missing.text')} />;
        }
        return (
          <QueryBoundary query={catalog}>
            {({ categories }) => (
              <QueryBoundary query={plus}>
                {(plusAccess) => (
                  <ChallengeTracking challenge={challenge} categories={categories} plusAccess={plusAccess} />
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        );
      }}
    </QueryBoundary>
  );
}

type SlotView = {
  id: string;
  habit: MyHabit;
  startsOn: IsoDate;
  dueOn: IsoDate;
  status: SlotStatus;
};

function ChallengeTracking({
  challenge,
  categories,
  plusAccess,
}: {
  challenge: Challenge;
  categories: HabitCategory[];
  plusAccess: boolean;
}) {
  const today = heute();
  const to = challenge.ends_on < today ? challenge.ends_on : today;
  const logs = useHabitLogs(challenge.starts_on, to < challenge.starts_on ? challenge.starts_on : to);

  return (
    <QueryBoundary query={logs}>
      {(entries) => (
        <TrackingContent
          challenge={challenge}
          categories={categories}
          plusAccess={plusAccess}
          entries={entries}
          today={today}
        />
      )}
    </QueryBoundary>
  );
}

function TrackingContent({
  challenge,
  categories,
  plusAccess,
  entries,
  today,
}: {
  challenge: Challenge;
  categories: HabitCategory[];
  plusAccess: boolean;
  entries: HabitLog[];
  today: IsoDate;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { scoreOn } = useHabitScoreEnabled();
  const cancel = useCancelChallenge();
  const remove = useDeleteChallenge();
  const [day, setDay] = useState<IsoDate>(initialDay(challenge.starts_on, challenge.ends_on, today));
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const phase = phaseOf(challenge, today);

  const { slots, perHabit } = useMemo(() => {
    const entriesOf = (userHabitId: string): ChallengeEntry[] =>
      entries
        .filter((e) => e.user_habit_id === userHabitId)
        .map((e) => ({
          date: e.log_date,
          value: e.value_numeric === null ? null : Number(e.value_numeric),
        }));

    const views: SlotView[] = challenge.challenge_slots.flatMap((slot) => {
      const item = challenge.challenge_items.find((i) => i.id === slot.item_id);
      const userHabit = item?.user_habits;
      if (!item || !userHabit?.habit_templates) return [];
      const habit = userHabit as MyHabit;
      const range = { startsOn: slot.starts_on, dueOn: slot.due_on };
      return [
        {
          id: slot.id,
          habit,
          ...range,
          status: slotStatus(range, entriesOf(habit.id), habit.habit_templates, today),
        },
      ];
    });

    const habits = challenge.challenge_items.flatMap((item) => {
      const userHabit = item.user_habits;
      if (!userHabit?.habit_templates) return [];
      const own = views.filter((v) => v.habit.id === userHabit.id);
      return [
        {
          item,
          title: userHabit.habit_templates.title,
          progress: progressOf(own.map((v) => v.status)),
        },
      ];
    });
    return { slots: views, perHabit: habits };
  }, [challenge, entries, today]);

  const total = progressOf(slots.map((s) => s.status));

  const markOf = (d: IsoDate): DayMark => {
    const due = slots.filter((s) => s.dueOn === d);
    const covering = slots.filter((s) => s.startsOn <= d && s.dueOn > d);
    if (due.length === 0)
      return {
        count: covering.length,
        tone: covering.length ? 'block' : 'none',
      };
    const tone = due.every((s) => s.status === 'done')
      ? 'done'
      : due.some((s) => s.status === 'missed')
        ? 'missed'
        : 'open';
    return { count: due.length, tone };
  };

  const dueToday = slots.filter((s) => s.dueOn === day);
  const blocksRunning = slots.filter((s) => s.startsOn <= day && s.dueOn > day);
  const canPlan = phase === 'running' || phase === 'upcoming';
  const error = cancel.error ?? remove.error;

  return (
    <View style={page.stack}>
      <Text role="heading" style={page.title}>
        {challenge.title}
      </Text>
      <Text style={page.meta}>
        {t(`challenges.phase.${phase}`)}
        {' · '}
        {t('challenges.range', {
          from: formatShort(challenge.starts_on),
          to: formatShort(challenge.ends_on),
        })}
      </Text>
      {challenge.description_md ? <Text style={page.text}>{challenge.description_md}</Text> : null}

      {/* Fortschritt: erfuellt von geplant (Entscheidung 01.11.2026), ohne Score. */}
      <View style={page.card}>
        <Text style={page.label}>{t('challenges.progressTitle')}</Text>
        <Text style={page.title}>{t('challenges.percent', { percent: total.percent })}</Text>
        <View style={page.bar} aria-hidden>
          <View style={[page.barFill, { width: `${total.percent}%` }]} />
        </View>
        <Text style={page.meta}>
          {t('challenges.progressDetail', {
            done: total.done,
            planned: total.planned,
            missed: total.missed,
            open: total.open,
          })}
        </Text>
        {perHabit.map(({ item, title, progress }) => (
          <View key={item.id} style={{ gap: 4 }}>
            <Text style={page.cardTitle}>{title}</Text>
            <Text style={page.meta}>
              {describePlan(parsePlan(item.plan), t)}
              {' · '}
              {t('challenges.progress', {
                done: progress.done,
                planned: progress.planned,
                percent: progress.percent,
              })}
            </Text>
            <View style={page.bar} aria-hidden>
              <View style={[page.barFill, { width: `${progress.percent}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <Text style={page.sectionTitle}>{t('challenges.calendar')}</Text>
      <Text style={page.meta}>{t('challenges.calendarHint')}</Text>
      <ChallengeCalendar
        startsOn={challenge.starts_on}
        endsOn={challenge.ends_on}
        today={today}
        selected={day}
        onPressDay={setDay}
        markOf={markOf}
        labelOf={(d, mark) => t('challenges.dayLabel', { day: formatDay(d), count: mark.count })}
      />

      <Text style={page.sectionTitle}>{formatDay(day)}</Text>
      {dueToday.length === 0 && blocksRunning.length === 0 ? (
        <Text style={page.text}>{t('challenges.dayEmpty')}</Text>
      ) : null}
      {blocksRunning.map((s) => (
        <Text key={`b-${s.id}`} style={page.text}>
          {t('challenges.blockRunning', {
            title: s.habit.habit_templates.title,
            from: formatShort(s.startsOn),
            to: formatShort(s.dueOn),
          })}
        </Text>
      ))}
      {dueToday.map((s) =>
        day <= today ? (
          <View key={s.id} style={{ gap: 4 }}>
            {s.startsOn < s.dueOn ? (
              <Text style={page.meta}>
                {t('challenges.blockDue', {
                  from: formatShort(s.startsOn),
                  to: formatShort(s.dueOn),
                })}
              </Text>
            ) : null}
            <HabitEntryRow
              habit={s.habit}
              date={day}
              log={entries.find((l) => l.user_habit_id === s.habit.id && l.log_date === day) ?? null}
              category={categories.find((c) => c.id === s.habit.habit_templates.category_id) ?? null}
              locked={!s.habit.habit_templates.is_preview && !plusAccess}
              scoreOn={scoreOn}
              past={day < today}
            />
          </View>
        ) : (
          <View key={s.id} style={page.card}>
            <Text style={page.cardTitle}>{s.habit.habit_templates.title}</Text>
            <Text style={page.meta}>
              {s.startsOn < s.dueOn
                ? t('challenges.blockDue', {
                    from: formatShort(s.startsOn),
                    to: formatShort(s.dueOn),
                  })
                : t('challenges.planned')}
            </Text>
          </View>
        ),
      )}

      <View style={[page.row, { marginTop: 16 }]}>
        {canPlan ? (
          <Link
            href={{
              pathname: '/habit-tracker/challenge-planen',
              params: { id: challenge.id },
            }}
            style={page.link}
          >
            {t('challenges.edit')}
          </Link>
        ) : null}
      </View>

      {error ? (
        <Text role="alert" style={page.error}>
          {t(challengeErrorKey(error))}
        </Text>
      ) : null}

      {confirm ? (
        <View style={page.card}>
          <Text style={page.text}>
            {t(confirm === 'cancel' ? 'challenges.cancelConfirm' : 'challenges.deleteConfirm')}
          </Text>
          <View style={page.row}>
            <PressableRing
              onPress={() =>
                confirm === 'cancel'
                  ? cancel.mutate(challenge.id, {
                      onSuccess: () => setConfirm(null),
                    })
                  : remove.mutate(challenge.id, {
                      onSuccess: () => router.replace('/habit-tracker/challenges'),
                    })
              }
              disabled={cancel.isPending || remove.isPending}
              style={page.danger}
            >
              <Text style={page.dangerText}>
                {t(confirm === 'cancel' ? 'challenges.cancelYes' : 'challenges.deleteYes')}
              </Text>
            </PressableRing>
            <PressableRing onPress={() => setConfirm(null)} style={page.secondary}>
              <Text style={page.secondaryText}>{t('challenges.keep')}</Text>
            </PressableRing>
          </View>
        </View>
      ) : (
        <View style={page.row}>
          {phase === 'running' || phase === 'upcoming' ? (
            <PressableRing onPress={() => setConfirm('cancel')} style={page.secondary}>
              <Text style={page.secondaryText}>{t('challenges.cancel')}</Text>
            </PressableRing>
          ) : null}
          <PressableRing onPress={() => setConfirm('delete')} style={page.secondary}>
            <Text style={page.secondaryText}>{t('challenges.delete')}</Text>
          </PressableRing>
        </View>
      )}
    </View>
  );
}
