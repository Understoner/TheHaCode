import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { today as heute, type IsoDate } from '@/features/habits/dates';
import { DiaryConsent } from '@/features/habits/DiaryConsent';
import { HabitDay } from '@/features/habits/HabitDay';
import { habitsForDay, parseDayParam } from '@/features/habits/pastDay';
import { enabledCategoryIds } from '@/features/habits/habitAreas';
import {
  useHabitAreas,
  useHabitCatalog,
  useHabitLogs,
  useHabitScoreEnabled,
  useMyHabits,
} from '@/features/habits/useHabits';

/**
 * Ein einzelner Tag, geoeffnet aus der Monatsuebersicht (30.10.2026): was an
 * dem Tag eingetragen ist, und Nachtragen oder Korrigieren, falls etwas
 * vergessen wurde. Geschrieben wird ueber dieselben Mutationen wie im
 * Tagebuch - Einwilligung und Plus prueft die Datenbank (0021).
 */
export default function TagScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const params = useLocalSearchParams<{ datum?: string }>();
  const today = heute();
  const date = parseDayParam(params.datum, today);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker" style={styles.back}>
        {t('diary.back')}
      </Link>
      <Text style={styles.title}>{t('diary.pastDay.title')}</Text>
      {date ? <Text style={styles.intro}>{t('diary.pastDay.intro')}</Text> : null}

      {loading ? (
        <SkeletonList />
      ) : !session ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('diary.login.title')}</Text>
          <Text style={styles.text}>{t('diary.login.text')}</Text>
          <Link href="/konto" style={styles.link}>
            {t('diary.login.action')}
          </Link>
        </View>
      ) : !date ? (
        <StateMessage title={t('diary.pastDay.invalid.title')} body={t('diary.pastDay.invalid.text')} />
      ) : (
        <DayForUser date={date} today={today} />
      )}
    </ScrollView>
  );
}

/** Wie im Tagebuch: ohne Einwilligung zuerst die Einwilligung (SAD §3.10). */
function DayForUser({ date, today }: { date: IsoDate; today: IsoDate }) {
  const { t } = useTranslation();
  const consents = useConsents();

  return (
    <QueryBoundary query={consents}>
      {(list) => {
        const health = list.find((c) => c.definition.kind === 'health_data');
        if (!health) {
          return <StateMessage title={t('diary.soon.title')} body={t('diary.soon.text')} />;
        }
        if (!health.granted && !health.latest) return <DiaryConsent definition={health.definition} />;

        return (
          <View style={styles.stack}>
            {!health.granted ? <DiaryConsent definition={health.definition} /> : null}
            <DayContent date={date} today={today} />
          </View>
        );
      }}
    </QueryBoundary>
  );
}

function DayContent({ date, today }: { date: IsoDate; today: IsoDate }) {
  const router = useRouter();
  const { scoreOn } = useHabitScoreEnabled();
  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const plus = usePlusAccess();
  const logs = useHabitLogs(date, date);
  const areas = useHabitAreas();

  return (
    <QueryBoundary query={catalog}>
      {({ categories }) => (
        <QueryBoundary query={myHabits}>
          {(habits) => (
            <QueryBoundary query={plus}>
              {(plusAccess) => (
                <QueryBoundary query={logs}>
                  {(entries) => (
                    <QueryBoundary query={areas.query}>
                      {(enabledAreas) => {
                        const shown = enabledCategoryIds(categories, enabledAreas);
                        return (
                          <HabitDay
                            date={date}
                            today={today}
                            // Blaettern bleibt auf dieser Seite und haelt den Tag
                            // in der Adresse - Zurueck im Browser fuehrt dann ins
                            // Tagebuch, nicht durch jeden einzelnen Tag.
                            onChangeDate={(d) => router.setParams({ datum: d > today ? today : d })}
                            habits={habitsForDay(habits, entries, date).filter((h) =>
                              shown.has(h.habit_templates.category_id),
                            )}
                            logs={entries}
                            categories={categories}
                            plusAccess={plusAccess}
                            scoreOn={scoreOn}
                          />
                        );
                      }}
                    </QueryBoundary>
                  )}
                </QueryBoundary>
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    // Volle Breite wie das Tagebuch; die Karten verteilen sich ueber
    // habits-grid in HabitDay.
    width: '100%',
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
  intro: {
    maxWidth: 720,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
  },
  stack: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
