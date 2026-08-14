import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { responsive } from '@/design/responsive';
import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import { useSessionsList } from '@/features/sessions/useSessions';
import type { PlayableExercise } from '@/types/breathing';

/** "4-4-4-4" aus den Phasen der ersten Runde - die Kurzform, die jeder kennt. */
function rhythmOf(exercise: PlayableExercise): string | null {
  const step = [...exercise.exercise_steps].sort((a, b) => a.position - b.position)[0];
  if (!step) return null;
  const phases = [...step.exercise_phases].sort((a, b) => a.position - b.position);
  if (phases.length === 0) return null;
  return phases
    .map((p) => {
      const n = Number(p.duration_seconds);
      return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
    })
    .join('-');
}

export function SessionsList() {
  const { t } = useTranslation();
  const query = useSessionsList();

  return (
    <QueryBoundary
      query={query}
      empty={{ title: t('sessions.empty.title'), hint: t('sessions.empty.hint') }}
    >
      {(sessions) => (
        <View {...responsive('sessions-grid')} style={styles.grid}>
          {sessions.map((session) => {
            const seconds = Math.round(totalDurationMs(buildTimeline(session)) / 1000);
            const rhythm = rhythmOf(session);

            return (
              <Link key={session.id} href={`/sessions/${session.id}`} style={styles.card}>
                <View style={styles.cardInner}>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {t('sessions.duration', { minutes: Math.max(1, Math.round(seconds / 60)) })}
                    </Text>
                    {session.default_round_count ? (
                      <Text style={styles.meta}>
                        {t('sessions.rounds', { count: session.default_round_count })}
                      </Text>
                    ) : null}
                    {session.difficulty ? (
                      <Text style={styles.meta}>{t(`sessions.difficulty.${session.difficulty}`)}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.title}>{session.title}</Text>
                  {session.subtitle ? <Text style={styles.subtitle}>{session.subtitle}</Text> : null}

                  {rhythm ? (
                    <View style={styles.rhythmPill}>
                      <Text style={styles.rhythmText}>{rhythm}</Text>
                    </View>
                  ) : null}
                </View>
              </Link>
            );
          })}
        </View>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  // display/flexDirection ausdruecklich: der Link rendert im Web ein <Text>
  // mit display: inline, das als Flex-Kind zu block wird - dieselbe Falle wie
  // in der Tab-Leiste (siehe NavBar.tsx).
  card: {
    flexGrow: 0,
    flexBasis: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardInner: {
    gap: spacing.sm,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontSize: 11,
    color: colors.ink700,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  subtitle: {
    fontSize: 13,
    color: colors.ink700,
  },
  rhythmPill: {
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
  },
  rhythmText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
    letterSpacing: 0.5,
  },
});
