import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import { useDeleteSequence, useMySequences } from '@/features/configurator/useSequences';
import type { PlayableExercise } from '@/types/breathing';
import { PressableRing } from '@/components/PressableRing';

function minuten(sequence: PlayableExercise): number {
  return Math.max(1, Math.round(totalDurationMs(buildTimeline(sequence)) / 60000));
}

export function MySequencesList() {
  const { t } = useTranslation();
  const query = useMySequences();

  return (
    <QueryBoundary
      query={query}
      empty={{ title: t('sequenz.leer.titel'), hint: t('sequenz.leer.hinweis') }}
    >
      {(sequences) => (
        <View style={styles.list}>
          {sequences.map((sequence) => (
            <SequenceCard key={sequence.id} sequence={sequence} />
          ))}
        </View>
      )}
    </QueryBoundary>
  );
}

function SequenceCard({ sequence }: { sequence: PlayableExercise }) {
  const { t } = useTranslation();
  const remove = useDeleteSequence();
  const [armed, setArmed] = useState(false);

  const bloecke = sequence.exercise_steps.length;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{sequence.title}</Text>
        <Text style={styles.meta}>
          {t('sessions.duration', { minutes: minuten(sequence) })}
          {bloecke > 1 ? ` · ${t('sessions.blocks', { count: bloecke })}` : ''}
        </Text>
      </View>

      {sequence.subtitle ? <Text style={styles.subtitle}>{sequence.subtitle}</Text> : null}

      <View style={styles.actions}>
        {/* Abspielen laeuft ueber denselben Player wie die redaktionellen
            Sequenzen - fuer die Engine ist eine eigene Sequenz nichts
            Besonderes (SAD §3.4). */}
        <Link href={`/sessions/${sequence.id}`} style={styles.primary}>
          {t('sessions.start')}
        </Link>
        <Link href={`/sequenzen/${sequence.id}`} style={styles.secondary}>
          {t('sequenz.bearbeiten')}
        </Link>

        {/* Loeschen bleibt immer erlaubt, auch ohne Plus (SAD §3.4) - deshalb
            steht es hier ohne jede Zugriffspruefung. */}
        {armed ? (
          <View style={styles.confirmRow}>
            <PressableRing
              disabled={remove.isPending}
              aria-disabled={remove.isPending}
              onPress={() => remove.mutate(sequence.id)}
              style={styles.danger}
            >
              <Text style={styles.dangerText}>
                {remove.isPending ? t('sequenz.loeschtGerade') : t('sequenz.loeschenBestaetigen')}
              </Text>
            </PressableRing>
            <PressableRing onPress={() => setArmed(false)} style={styles.secondaryBox}>
              <Text style={styles.secondary}>{t('auth.delete.cancel')}</Text>
            </PressableRing>
          </View>
        ) : (
          <PressableRing onPress={() => setArmed(true)} style={styles.secondaryBox}>
            <Text style={styles.quiet}>{t('sequenz.loeschen')}</Text>
          </PressableRing>
        )}
      </View>

      {remove.isError ? (
        <Text role="alert" style={styles.error}>
          {t('errors:sequenz.loeschen')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
  },
  card: {
    gap: 6,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  head: {
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  meta: {
    fontSize: 13,
    color: colors.ink700,
  },
  subtitle: {
    fontSize: 14,
    color: colors.ink700,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  primary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  secondary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  secondaryBox: {
    paddingVertical: 4,
  },
  quiet: {
    fontSize: 14,
    color: colors.ink700,
    textDecorationLine: 'underline',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  danger: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  dangerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.surface,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
