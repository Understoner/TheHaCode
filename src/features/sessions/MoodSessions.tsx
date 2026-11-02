import { Link, useRouter } from 'expo-router';
import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FavoriteStar } from '@/components/FavoriteStar';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import { type SessionFilter } from '@/features/sessions/effects';
import {
  daySlot,
  firstRound,
  leadMood,
  MOODS,
  moodsOf,
  sessionKind,
  suggestFor,
  type Mood,
} from '@/features/sessions/moods';
import { ClockGlyph, EffectGlyph, effectTone, MoodGlyph, PlayGlyph, SessionThumb } from '@/features/sessions/SessionArt';
import { useFavorites } from '@/features/sessions/useFavorites';
import { useSessionsList } from '@/features/sessions/useSessions';
import type { PlayableExercise } from '@/types/breathing';

// Die Sessions im Vorschlag "Mondlicht Mobile" (02.11.2026, nur Testsystem):
// Einstieg ueber "Wie willst du dich fuehlen?" statt ueber Filter, oben ein
// Vorschlag zur Tageszeit, jede Session mit ihrer Atemform als Kurve. Die
// Stimmungen kommen aus den Wirkungs-Chips (moods.ts). Der bisherige Filter
// (Favoriten, Wirkung) bleibt ueber das Symbol oben erreichbar und wirkt
// zusaetzlich.

/** Minuten einer Session: Box aus den Phasen, Aufnahme aus estimated_seconds. */
function minutesOf(session: PlayableExercise): number | null {
  const seconds =
    sessionKind(session) === 'box'
      ? Math.round(totalDurationMs(buildTimeline(session)) / 1000)
      : (session.estimated_seconds ?? 0);
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
}

/** "4-4-4-4" - nur fuer Box-Sessions mit einem Block, wie SessionsList.tsx. */
function rhythmOf(session: PlayableExercise): string | null {
  if (sessionKind(session) !== 'box' || session.exercise_steps.length !== 1) return null;
  const round = firstRound(session);
  if (round.length === 0) return null;
  return round.map((p) => String(p.seconds).replace('.', ',')).join('-');
}

function noSubscription() {
  return () => undefined;
}

/** Erst im Browser: beim statischen Rendern gibt es keine Uhrzeit des Nutzers (wie StartScreen.tsx). */
function useNow(): Date | null {
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  return hydrated ? new Date() : null;
}

export function MoodSessions({ filter, mood }: { filter: SessionFilter; mood: Mood | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const palette = useThemePalette();
  const now = useNow();
  const effekt = filter === 'all' || filter === 'favoriten' ? undefined : filter;
  const query = useSessionsList(effekt);
  const favoriten = useFavorites();

  const pick = (next: Mood) => router.setParams({ stimmung: mood === next ? '' : next });

  return (
    <View style={styles.container}>
      <View role="radiogroup" aria-label={t('sessions.mood.label')} style={styles.moodGrid}>
        {MOODS.map((m) => {
          const on = m === mood;
          return (
            <PressableRing
              key={m}
              onPress={() => pick(m)}
              role="radio"
              aria-checked={on}
              style={[styles.moodTile, on && styles.moodTileOn]}
            >
              <MoodGlyph mood={m} color={on ? palette.surface : palette.ink900} />
              <Text style={[styles.moodText, on && styles.moodTextOn]}>{t(`sessions.mood.${m}`)}</Text>
            </PressableRing>
          );
        })}
      </View>

      <QueryBoundary query={query} empty={{ title: t('sessions.empty.title'), hint: t('sessions.empty.hint') }}>
        {(sessions) => {
          if (filter === 'favoriten' && favoriten.laedt) return <SkeletonList />;
          const base = filter === 'favoriten' ? sessions.filter((s) => favoriten.istFavorit(s.id)) : sessions;
          const shown = mood ? base.filter((s) => moodsOf(s.effects).includes(mood)) : base;
          const suggestion = !mood && filter === 'all' && now ? suggestFor(sessions, now, sessionKind) : null;

          return (
            <View style={styles.listBlock}>
              {suggestion && now ? <Suggestion session={suggestion} now={now} /> : null}

              <View style={styles.listHead}>
                <Text role="heading" aria-level={2} style={styles.listTitle}>
                  {mood ? t('sessions.mood.for', { mood: t(`sessions.mood.${mood}`) }) : t('sessions.mood.all')}
                </Text>
                <Text style={styles.count}>{t('sessions.count', { count: shown.length })}</Text>
              </View>

              {shown.length === 0 ? (
                <StateMessage title={t('sessions.mood.empty.title')} body={t('sessions.mood.empty.hint')} />
              ) : (
                <View style={styles.rows}>
                  {shown.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </View>
              )}
            </View>
          );
        }}
      </QueryBoundary>
    </View>
  );
}

function Suggestion({ session, now }: { session: PlayableExercise; now: Date }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const minutes = minutesOf(session);
  const meta = [minutes ? t('sessions.duration', { minutes }) : null, session.subtitle].filter(Boolean).join(' · ');

  return (
    <Link href={`/sessions/${session.id}`} style={styles.suggestLink}>
      <View style={styles.suggest}>
        <MoodGlyph mood={leadMood(session.effects) ?? 'ruhig'} color={palette.ocean700} size={40} />
        <View style={styles.suggestText}>
          <Text style={styles.suggestBadge}>{t(`sessions.suggest.${daySlot(now)}`)}</Text>
          <Text data-font="display" style={styles.suggestTitle}>
            {session.title}
          </Text>
          {meta ? <Text style={styles.suggestMeta}>{meta}</Text> : null}
        </View>
        <View aria-hidden style={styles.play}>
          <PlayGlyph color={palette.surface} />
        </View>
      </View>
    </Link>
  );
}

function SessionRow({ session }: { session: PlayableExercise }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const kind = sessionKind(session);
  const phases = useMemo(() => firstRound(session), [session]);
  const minutes = minutesOf(session);
  const rhythm = rhythmOf(session);
  const tone = session.effects[0] ? effectTone(session.effects[0], palette) : palette.ink700;

  return (
    <View style={styles.rowShell}>
      <Link href={`/sessions/${session.id}`} style={styles.rowLink}>
        <View style={styles.row}>
          <SessionThumb kind={kind} phases={phases} tone={tone} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {session.title}
            </Text>
            <View style={styles.rowMeta}>
              {kind !== 'box' ? <Text style={styles.metaText}>{t(`sessions.kind.${kind}`)}</Text> : null}
              {minutes ? (
                <View style={styles.metaItem}>
                  <ClockGlyph color={palette.ink700} />
                  <Text style={styles.metaText}>{t('sessions.duration', { minutes })}</Text>
                </View>
              ) : null}
              {rhythm ? <Text style={styles.metaText}>{rhythm}</Text> : null}
              {session.effects.map((effect) => (
                <View key={effect} accessibilityLabel={t(`sessions.effects.${effect}`)}>
                  <EffectGlyph effect={effect} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </Link>
      {/* Der Stern liegt ueber der Karte, nicht in ihr: alles im Link fuehrt zur Session. */}
      <View style={styles.star}>
        <FavoriteStar exerciseId={session.id} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    maxWidth: 720,
    width: '100%',
  },
  moodGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  moodTileOn: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  moodText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink900,
  },
  moodTextOn: {
    color: colors.surface,
  },
  listBlock: {
    gap: spacing.md,
  },
  suggestLink: {
    display: 'flex',
    flexDirection: 'column',
    textDecorationLine: 'none',
  },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.surface,
  },
  suggestText: {
    flex: 1,
    minWidth: 0,
  },
  suggestBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ocean700,
  },
  suggestTitle: {
    fontSize: 19,
    lineHeight: 23,
    color: colors.ink900,
  },
  suggestMeta: {
    fontSize: 12,
    color: colors.ink700,
  },
  play: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ocean700,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink900,
  },
  count: {
    fontSize: 12,
    color: colors.ink700,
  },
  rows: {
    gap: spacing.sm,
  },
  rowShell: {
    position: 'relative',
  },
  rowLink: {
    display: 'flex',
    flexDirection: 'column',
    textDecorationLine: 'none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
    paddingVertical: 10,
    paddingLeft: 12,
    // Platz fuer den Stern rechts.
    paddingRight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: colors.ink900,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 2,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.ink700,
  },
  star: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
