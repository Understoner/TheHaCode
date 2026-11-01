import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { useAuth } from '@/features/auth/AuthProvider';
import { page } from '@/features/challenges/pageStyles';
import { phaseOf, progressOf, slotStatus, type ChallengePhase } from '@/features/challenges/plan';
import {
  useChallengeTemplates,
  useMyChallenges,
  type Challenge,
  type ChallengeTemplate,
} from '@/features/challenges/useChallenges';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { today as heute, type IsoDate } from '@/features/habits/dates';
import { formatShort } from '@/features/habits/format';
import { useHabitLogs } from '@/features/habits/useHabits';

/**
 * Challenges (0036): die eigenen, laufende zuerst, darunter die Vorlagen der
 * Redaktion und der Weg zur eigenen. Lesen geht immer, planen mit Plus (oder
 * einer Vorschau-Vorlage) und Einwilligung.
 */
export default function ChallengesScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={page.container}>
      <Link href="/habit-tracker" style={page.back}>
        {t('diary.back')}
      </Link>
      <Text role="heading" style={page.title}>
        {t('challenges.title')}
      </Text>
      <Text style={page.text}>{t('challenges.intro')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <ChallengesForUser />
      ) : (
        <View style={page.card}>
          <Text style={page.cardTitle}>{t('diary.login.title')}</Text>
          <Text style={page.text}>{t('challenges.login')}</Text>
          <Link href="/konto" style={page.link}>
            {t('diary.login.action')}
          </Link>
        </View>
      )}
    </ScrollView>
  );
}

function ChallengesForUser() {
  const { t } = useTranslation();
  const today = heute();
  const challenges = useMyChallenges();
  const templates = useChallengeTemplates();
  const plus = usePlusAccess();
  const consents = useConsents();

  return (
    <QueryBoundary query={challenges}>
      {(list) => (
        <QueryBoundary query={templates}>
          {(templateList) => (
            <QueryBoundary query={plus}>
              {(plusAccess) => (
                <QueryBoundary query={consents}>
                  {(consentList) => {
                    const consented = consentList.some((c) => c.definition.kind === 'health_data' && c.granted);
                    return (
                      <View style={page.stack}>
                        <Text style={page.sectionTitle}>{t('challenges.mine')}</Text>
                        {list.length === 0 ? (
                          <StateMessage title={t('challenges.empty.title')} body={t('challenges.empty.text')} />
                        ) : (
                          <MyChallengeList challenges={list} today={today} />
                        )}

                        {!consented ? (
                          <View style={page.card}>
                            <Text style={page.text}>{t('challenges.consentNeeded')}</Text>
                            <Link href="/habit-tracker" style={page.link}>
                              {t('challenges.toDiary')}
                            </Link>
                          </View>
                        ) : null}

                        <Text style={page.sectionTitle}>{t('challenges.templates')}</Text>
                        {templateList.length === 0 ? (
                          <StateMessage
                            title={t('challenges.noTemplates.title')}
                            body={t('challenges.noTemplates.text')}
                          />
                        ) : (
                          templateList.map((tpl) => (
                            <TemplateCard
                              key={tpl.id}
                              template={tpl}
                              canStart={consented && (plusAccess || tpl.is_preview)}
                              plusAccess={plusAccess}
                            />
                          ))
                        )}

                        <Text style={page.sectionTitle}>{t('challenges.own.title')}</Text>
                        <View style={page.card}>
                          <Text style={page.text}>
                            {t(plusAccess ? 'challenges.own.text' : 'challenges.own.plusOnly')}
                          </Text>
                          {plusAccess && consented ? (
                            <Link href="/habit-tracker/challenge-planen" style={page.link}>
                              {t('challenges.own.action')}
                            </Link>
                          ) : null}
                        </View>
                      </View>
                    );
                  }}
                </QueryBoundary>
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

const PHASE_ORDER: Record<ChallengePhase, number> = {
  running: 0,
  upcoming: 1,
  finished: 2,
  cancelled: 3,
};

function MyChallengeList({ challenges, today }: { challenges: Challenge[]; today: IsoDate }) {
  // Einträge über alle Challenges in einer Abfrage, bis heute.
  const from = challenges.reduce((min, c) => (c.starts_on < min ? c.starts_on : min), today);
  const logs = useHabitLogs(from, today);
  const sorted = [...challenges].sort(
    (a, b) => PHASE_ORDER[phaseOf(a, today)] - PHASE_ORDER[phaseOf(b, today)] || (a.starts_on < b.starts_on ? 1 : -1),
  );

  return (
    <QueryBoundary query={logs}>
      {(entries) => (
        <View style={page.stack}>
          {sorted.map((c) => (
            <ChallengeCard key={c.id} challenge={c} today={today} entries={entries} />
          ))}
        </View>
      )}
    </QueryBoundary>
  );
}

function ChallengeCard({
  challenge,
  today,
  entries,
}: {
  challenge: Challenge;
  today: IsoDate;
  entries: {
    user_habit_id: string;
    log_date: string;
    value_numeric: number | null;
  }[];
}) {
  const { t } = useTranslation();
  const phase = phaseOf(challenge, today);
  const progress = progressOf(
    challenge.challenge_slots.flatMap((slot) => {
      const item = challenge.challenge_items.find((i) => i.id === slot.item_id);
      const template = item?.user_habits?.habit_templates;
      if (!item || !template) return [];
      const own = entries
        .filter((e) => e.user_habit_id === item.user_habit_id)
        .map((e) => ({
          date: e.log_date,
          value: e.value_numeric === null ? null : Number(e.value_numeric),
        }));
      return [slotStatus({ startsOn: slot.starts_on, dueOn: slot.due_on }, own, template, today)];
    }),
  );

  return (
    // flatten: expo-router lehnt bei asChild ein Stil-Array ab (HeaderIcon.tsx).
    <Link
      href={{
        pathname: '/habit-tracker/challenge',
        params: { id: challenge.id },
      }}
      asChild
    >
      <PressableRing role="link" style={StyleSheet.flatten(page.card)}>
        <Text style={page.badge}>{t(`challenges.phase.${phase}`)}</Text>
        <Text style={page.cardTitle}>{challenge.title}</Text>
        <Text style={page.meta}>
          {t('challenges.range', {
            from: formatShort(challenge.starts_on),
            to: formatShort(challenge.ends_on),
          })}
          {' · '}
          {t('challenges.habitCount', {
            count: challenge.challenge_items.length,
          })}
        </Text>
        <View style={page.bar} aria-hidden>
          <View style={[page.barFill, { width: `${progress.percent}%` }]} />
        </View>
        <Text style={page.meta}>
          {t('challenges.progress', {
            done: progress.done,
            planned: progress.planned,
            percent: progress.percent,
          })}
        </Text>
      </PressableRing>
    </Link>
  );
}

function TemplateCard({
  template,
  canStart,
  plusAccess,
}: {
  template: ChallengeTemplate;
  canStart: boolean;
  plusAccess: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={page.card}>
      <Text style={page.badge}>{template.is_preview ? t('challenges.badge.preview') : t('challenges.badge.plus')}</Text>
      <Text style={page.cardTitle}>{template.title}</Text>
      <Text style={page.meta}>
        {t('challenges.days', { count: template.duration_days })}
        {' · '}
        {template.challenge_template_items.map((i) => i.habit_templates?.title).join(', ')}
      </Text>
      {template.description_md ? <Text style={page.text}>{template.description_md}</Text> : null}
      {canStart ? (
        <Link
          href={{
            pathname: '/habit-tracker/challenge-planen',
            params: { vorlage: template.id },
          }}
          style={page.link}
        >
          {t('challenges.start')}
        </Link>
      ) : !plusAccess && !template.is_preview ? (
        <Text style={page.meta}>{t('challenges.plusOnly')}</Text>
      ) : null}
    </View>
  );
}
