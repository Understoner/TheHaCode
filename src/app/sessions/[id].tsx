import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { VolumeSlider } from '@/components/VolumeSlider';
import { colors, radius, spacing } from '@/design/tokens';
import { BreathCircle } from '@/features/breathing/BreathCircle';
import { createMusicPlayer, TRACKS, type TrackId } from '@/features/breathing/music';
import { createAudioContext, playCue } from '@/features/breathing/tones';
import {
  buildTimeline,
  segmentIndexAt,
  totalDurationMs,
  type TimelineSegment,
} from '@/features/breathing/timeline';
import { useBreathClock } from '@/features/breathing/useBreathClock';
import { effectColors } from '@/features/sessions/effects';
import { useSession } from '@/features/sessions/useSessions';
import type { PlayableExercise } from '@/types/breathing';

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function SessionPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSession(id);

  return <QueryBoundary query={query}>{(session) => <Player session={session} />}</QueryBoundary>;
}

function Player({ session }: { session: PlayableExercise }) {
  const { t } = useTranslation();
  const timeline = useMemo(() => buildTimeline(session), [session]);
  const totalMs = useMemo(() => totalDurationMs(timeline), [timeline]);

  const clock = useBreathClock();
  const [segIndex, setSegIndex] = useState(-1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const [musicTrack, setMusicTrack] = useState<TrackId | null>(null);
  // Getrennte Lautstaerken: der Ton markiert den Phasenwechsel und muss sich
  // durchsetzen, die Musik traegt nur den Hintergrund.
  const [toneVolume, setToneVolume] = useState(0.5);
  const [musicVolume, setMusicVolume] = useState(0.18);

  const audioRef = useRef<AudioContext | null>(null);
  const lastCuedRef = useRef(-1);
  const musicRef = useRef<ReturnType<typeof createMusicPlayer> | null>(null);

  const segment: TimelineSegment | null = segIndex >= 0 ? timeline[segIndex] : null;

  // Alle Segmente der laufenden Runde - der Ring teilt seine 180-Grad-Haelften
  // nach deren Dauern auf (ui/references/03_atem_animation.svg).
  const roundSegments = useMemo(() => {
    if (!segment) return [];
    return timeline.filter((s) => s.stepIndex === segment.stepIndex && s.round === segment.round);
  }, [timeline, segment]);

  // Anzeige-Schleife ueber requestAnimationFrame statt setInterval, und es wird
  // nur neu gerendert, wenn sich Segment oder angezeigte Sekunde aendern - der
  // Ring selbst laeuft ueber Animated und braucht gar keinen Re-Render
  // (BACKLOG T09: ein Re-Render je Phasenwechsel, nicht je Bild).
  useEffect(() => {
    if (!clock.isRunning) return;
    let raf = 0;

    const tick = () => {
      const now = clock.elapsed();
      const idx = segmentIndexAt(timeline, now);

      setSegIndex((prev) => (prev === idx ? prev : idx));
      setElapsedMs((prev) => (Math.floor(prev / 250) === Math.floor(now / 250) ? prev : now));

      if (idx === -1 && now >= totalMs) {
        clock.pause();
        setFinished(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, timeline, totalMs]);

  // Ton am Phasenbeginn, genau einmal je Segment.
  useEffect(() => {
    if (!soundOn || !segment || segIndex === lastCuedRef.current) return;
    lastCuedRef.current = segIndex;
    // In der Pause zwischen zwei Bloecken schlaegt nichts an - sie ist
    // Ruhe, kein Phasenwechsel.
    if (segment.kind === 'rest') return;
    playCue(audioRef.current, segment.kind, segment.durationMs, toneVolume);
  }, [segIndex, segment, soundOn, toneVolume]);

  // Musik folgt zwei Dingen: der Auswahl und dem Laufzustand. Pausiert die
  // Uebung, pausiert auch die Musik - sonst laeuft sie weiter, waehrend
  // niemand mehr atmet.
  useEffect(() => {
    if (!musicRef.current) musicRef.current = createMusicPlayer();
    const music = musicRef.current;

    if (!musicTrack) {
      music.stop();
      return;
    }
    music.setVolume(musicVolume);
    if (clock.isRunning) music.play(musicTrack);
    else music.pause();
  }, [musicTrack, clock.isRunning, musicVolume]);

  // Beim Verlassen des Players verstummt die Musik - ein Stueck, das nach dem
  // Zurueckgehen weiterlaeuft, waere das Aergerlichste an der Funktion.
  useEffect(() => () => musicRef.current?.dispose(), []);

  const start = useCallback(() => {
    // Der AudioContext darf erst auf eine Nutzergeste entstehen - ein Aufruf
    // aus useEffect heraus wird von Browsern blockiert (SAD §7.5).
    if (!audioRef.current) audioRef.current = createAudioContext();
    void audioRef.current?.resume?.();
    setFinished(false);
    clock.start();
  }, [clock]);

  const restart = useCallback(() => {
    clock.reset();
    lastCuedRef.current = -1;
    setSegIndex(-1);
    setElapsedMs(0);
    setFinished(false);
    start();
  }, [clock, start]);

  const stepCount = session.exercise_steps.length;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.topRow}>
        <Link href="/sessions" style={styles.back}>
          {`‹ ${t('player.end')}`}
        </Link>
        <Text style={styles.clock}>
          {mmss(elapsedMs)} / {mmss(totalMs)}
        </Text>
      </View>

      {/* Die Effekte stehen ueber dem Kreis: sie sagen, worauf die Uebung
          wirkt, und gehoeren damit vor die Uebung, nicht hinter sie. */}
      {session.effects.length > 0 ? (
        <View style={styles.effectRow}>
          {session.effects.map((effect) => {
            const tone = effectColors(effect);
            return (
              <View key={effect} style={[styles.effectPill, { backgroundColor: tone.tint }]}>
                <Text style={[styles.effectText, { color: tone.text }]}>
                  {t(`sessions.effects.${effect}`)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.stage}>
        <BreathCircle segment={segment} round={roundSegments} running={clock.isRunning} />
      </View>

      <View style={styles.readout}>
        {finished ? (
          <>
            <Text style={styles.phase}>{t('player.done.title')}</Text>
            <Text style={styles.cue}>
              {t('player.done.hint', {
                minutes: Math.max(1, Math.round(totalMs / 60000)),
              })}
            </Text>
          </>
        ) : segment?.kind === 'rest' ? (
          <>
            <Text style={styles.phase}>{t('phase.rest')}</Text>
            <Text style={styles.cue}>{t('player.restCue')}</Text>
            <Text style={styles.counter}>
              {segment.stepIndex + 1 < stepCount
                ? `${t('player.nextBlock', { block: segment.stepIndex + 2, total: stepCount })} · `
                : ''}
              {t('player.remaining', {
                seconds: Math.max(0, Math.ceil((segment.endMs - elapsedMs) / 1000)),
              })}
            </Text>
          </>
        ) : segment ? (
          <>
            <Text style={styles.phase}>{t(`phase.${segment.kind}`)}</Text>
            {segment.cue ? <Text style={styles.cue}>{segment.cue}</Text> : null}
            <Text style={styles.counter}>
              {stepCount > 1
                ? `${t('player.block', { block: segment.stepIndex + 1, total: stepCount })} · `
                : ''}
              {t('player.round', {
                round: segment.round,
                total: segment.roundsInStep,
              })}{' '}
              ·{' '}
              {t('player.remaining', {
                seconds: Math.max(0, Math.ceil((segment.endMs - elapsedMs) / 1000)),
              })}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.phase}>{session.title}</Text>
            {session.subtitle ? <Text style={styles.cue}>{session.subtitle}</Text> : null}
          </>
        )}
      </View>

      <View style={styles.controls}>
        {finished ? (
          <Pressable onPress={restart} style={styles.primary}>
            <Text style={styles.primaryText}>{t('player.restart')}</Text>
          </Pressable>
        ) : clock.isRunning ? (
          <Pressable onPress={clock.pause} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('player.pause')}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={start} style={styles.primary}>
            <Text style={styles.primaryText}>
              {elapsedMs > 0 ? t('player.resume') : t('sessions.start')}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => setSoundOn((s) => !s)}
          style={[styles.secondary, soundOn && styles.secondaryActive]}
        >
          <Text style={[styles.secondaryText, soundOn && styles.secondaryTextActive]}>
            {soundOn ? t('player.soundOn') : t('player.soundOff')}
          </Text>
        </Pressable>
      </View>

      {/* Musik getrennt vom Ton: beides laesst sich unabhaengig schalten. */}
      <View style={styles.musicRow}>
        <Text style={styles.musicLabel}>{t('player.musicLabel')}</Text>
        <View style={styles.musicChoices}>
          <Pressable
            onPress={() => setMusicTrack(null)}
            style={[styles.chip, musicTrack === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, musicTrack === null && styles.chipTextActive]}>
              {t('player.musicOff')}
            </Text>
          </Pressable>
          {TRACKS.map((track) => (
            <Pressable
              key={track.id}
              onPress={() => setMusicTrack(track.id)}
              style={[styles.chip, musicTrack === track.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, musicTrack === track.id && styles.chipTextActive]}>
                {t(`player.music.${track.id}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Zwei Regler, weil Ton und Musik unterschiedliche Aufgaben haben:
        der Ton markiert den Wechsel und muss sich durchsetzen, die Musik
        traegt den Hintergrund. Ein gemeinsamer Regler wuerde beide
        verschieben. */}
        <View style={styles.sliders}>
          <VolumeSlider
            label={t('player.volumeTone')}
            value={toneVolume}
            onChange={setToneVolume}
          />
          <VolumeSlider
            label={t('player.volumeMusic')}
            value={musicVolume}
            onChange={setMusicVolume}
          />
        </View>
      </View>

      {session.description_md ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sessions.about')}</Text>
          <Text style={styles.sectionText}>{session.description_md}</Text>
        </View>
      ) : null}

      {session.benefits_md ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sessions.benefits')}</Text>
          <Text style={styles.sectionText}>{session.benefits_md}</Text>
        </View>
      ) : null}

      {session.contraindications_md ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t('sessions.notice')}</Text>
          <Text style={styles.noticeText}>{session.contraindications_md}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    maxWidth: 620,
    width: '100%',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  clock: {
    fontSize: 13,
    color: colors.ink700,
  },
  sliders: {
    alignSelf: 'stretch',
    maxWidth: 320,
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stage: {
    paddingVertical: spacing.md,
  },
  readout: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 96,
  },
  phase: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.ink900,
  },
  cue: {
    fontSize: 15,
    color: colors.ink700,
    textAlign: 'center',
  },
  counter: {
    fontSize: 13,
    color: colors.ink700,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.ocean700,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  primaryText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '500',
  },
  secondary: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryText: {
    color: colors.ink700,
    fontSize: 14,
  },
  secondaryActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  secondaryTextActive: {
    color: colors.ocean700,
    fontWeight: '600',
  },
  musicRow: {
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 620,
  },
  musicLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  musicChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  chipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  chipTextActive: {
    color: colors.ocean700,
    fontWeight: '600',
  },
  effectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 620,
  },
  effectPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  effectText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Beschreibung und Wirkung stehen unter den Bedienelementen, nicht darueber:
  // wer die Uebung startet, soll nicht erst scrollen muessen.
  section: {
    maxWidth: 620,
    gap: 6,
    alignSelf: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
    textAlign: 'center',
  },
  notice: {
    maxWidth: 620,
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
});
