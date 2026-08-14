import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { responsive } from '@/design/responsive';
import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import {
  EXERCISE_EFFECTS,
  effectColors,
  type ExerciseEffect,
} from '@/features/sessions/effects';
import { useSessionsList } from '@/features/sessions/useSessions';
import type { PlayableExercise } from '@/types/breathing';

type Filter = ExerciseEffect | 'all';

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
  const [filter, setFilter] = useState<Filter>('all');
  const query = useSessionsList(filter === 'all' ? undefined : filter);

  const filters: Filter[] = ['all', ...EXERCISE_EFFECTS];

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {filters.map((value) => {
          const active = value === filter;
          const tone = value === 'all' ? null : effectColors(value);
          return (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              style={[
                styles.filterChip,
                active &&
                  (tone
                    ? { backgroundColor: tone.tint, borderColor: tone.text }
                    : styles.filterChipActiveAll),
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active &&
                    (tone ? { color: tone.text, fontWeight: '600' } : styles.filterChipTextActiveAll),
                ]}
              >
                {value === 'all' ? t('sessions.filter.all') : t(`sessions.effects.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
                        <Text style={styles.meta}>
                          {t(`sessions.difficulty.${session.difficulty}`)}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.title}>{session.title}</Text>
                    {session.subtitle ? (
                      <Text style={styles.subtitle}>{session.subtitle}</Text>
                    ) : null}

                    <View style={styles.tagRow}>
                      {rhythm ? (
                        <View style={styles.rhythmPill}>
                          <Text style={styles.rhythmText}>{rhythm}</Text>
                        </View>
                      ) : null}
                      {session.effects.map((effect) => {
                        const tone = effectColors(effect);
                        return (
                          <View
                            key={effect}
                            style={[styles.effectPill, { backgroundColor: tone.tint }]}
                          >
                            <Text style={[styles.effectText, { color: tone.text }]}>
                              {t(`sessions.effects.${effect}`)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </Link>
              );
            })}
          </View>
        )}
      </QueryBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  filterChipActiveAll: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  filterChipTextActiveAll: {
    color: colors.surface,
    fontWeight: '600',
  },
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rhythmPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  rhythmText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
    letterSpacing: 0.5,
  },
  effectPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  effectText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
