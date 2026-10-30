import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { addDays, today as heute } from '@/features/habits/dates';
import { DiaryInsights } from '@/features/habits/DiaryInsights';
import {
  useHabitCatalog,
  useHabitLogs,
  useHabitScoreEnabled,
  useMyHabits,
  useMySessions,
} from '@/features/habits/useHabits';

// Genug fuer BOLT-Verlauf und den Vergleich zweier 4-Wochen-Zeitraeume.
const LOOKBACK_DAYS = 120;

/**
 * Die Auswertung des Tagebuchs auf eigener Seite (30.10.2026), erreichbar
 * ueber das Balkensymbol neben der Ueberschrift. Lesen geht immer, auch nach
 * Widerruf der Einwilligung (SAD §3.10) - deshalb fragt diese Seite die
 * Einwilligung nicht ab.
 */
export default function AuswertungScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker" style={styles.back}>
        {t('diary.back')}
      </Link>
      <Text style={styles.title}>{t('diary.analysis.title')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <InsightsForUser />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('diary.login.title')}</Text>
          <Text style={styles.text}>{t('diary.login.text')}</Text>
          <Link href="/konto" style={styles.link}>
            {t('diary.login.action')}
          </Link>
        </View>
      )}
    </ScrollView>
  );
}

function InsightsForUser() {
  const today = heute();
  // Ab dem 1. Jaenner, weil der Score auch das Jahr zeigt (score.ts).
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const from = [addDays(today, -LOOKBACK_DAYS), yearStart].sort()[0];

  const { scoreOn } = useHabitScoreEnabled();
  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const logs = useHabitLogs(from, today);
  const sessions = useMySessions();

  return (
    <QueryBoundary query={catalog}>
      {({ categories }) => (
        <QueryBoundary query={myHabits}>
          {(habits) => (
            <QueryBoundary query={logs}>
              {(entries) => (
                <QueryBoundary query={sessions}>
                  {(sessionList) => (
                    <DiaryInsights
                      today={today}
                      habits={habits}
                      logs={entries}
                      sessions={sessionList}
                      categories={categories}
                      scoreOn={scoreOn}
                    />
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
    // habits-grid.
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
