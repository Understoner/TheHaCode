import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { useWakeLock } from '@/features/breathing/useWakeLock';

// Gesprochene Aufnahmen in Onlinekursen (V1.2, SAD §11.2, Schritt 4).
//
// EIN AUDIO-ELEMENT, KEINE WEB-AUDIO-KETTE
// ----------------------------------------
// Die Toene der Atemuebungen kommen aus dem Oszillator (CLAUDE.md). Eine
// Aufnahme ist dagegen eine Datei, die von vorn bis hinten laeuft - dafuer
// ist das schlichte <audio>-Element da: es streamt, puffert und spult selbst.
// Keine Marker, keine zweite Zeitachse (Quelle B aus SAD §7.2 kommt spaeter).
//
// DER BILDSCHIRM BLEIBT AN (SAD §7.7, Test T01a am 03.11.2026)
// -------------------------------------------------------------
// In der installierten PWA bricht iOS die Wiedergabe ab, sobald das iPhone
// gesperrt wird. Deshalb haelt der Player waehrend der Wiedergabe den
// Bildschirm wach und sagt das auch - sonst sperrt jemand das Handy, die
// Stimme verstummt, und niemand weiss warum.
//
// Die Zeitanzeige kommt aus dem Element selbst (timeupdate), nicht aus einem
// eigenen Takt - kein setInterval (CLAUDE.md).
//
// Wechselt die Aufnahme, gibt die aufrufende Stelle dem Player einen neuen
// key (etwa die Block-ID) - so beginnen Position und Fehlerzustand frisch.

type Props = {
  /** Signierte Adresse der Aufnahme; null, solange sie noch geladen wird oder fehlt. */
  src: string | null;
  title: string;
  /** Bekannte Laenge aus der Redaktion - gilt, bis die Datei ihre eigene meldet. */
  durationSec?: number | null;
  /** Einmal am Ende der Aufnahme: der Block gilt dann als erledigt. */
  onEnded?: () => void;
  /** Neu laden, etwa wenn die signierte Adresse abgelaufen ist. */
  onRetry?: () => void;
};

const SKIP_SECONDS = 15;

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function AudioPlayer({ src, title, durationSec, onEnded, onRetry }: Props) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);
  const [failed, setFailed] = useState(false);

  useWakeLock(playing);

  useEffect(() => {
    if (!src || typeof Audio === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = src;
    audioRef.current = audio;

    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      onEndedRef.current?.();
    };
    const onError = () => {
      setPlaying(false);
      setFailed(true);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      audio.removeAttribute('src');
      audioRef.current = null;
      setPlaying(false);
    };
  }, [src]);

  // Titel fuer Sperrbildschirm und Kopfhoerer-Tasten, wo es sie gibt.
  useEffect(() => {
    if (!playing || typeof navigator === 'undefined') return;
    const session = (navigator as unknown as { mediaSession?: { metadata: unknown } }).mediaSession;
    const Meta = (globalThis as unknown as { MediaMetadata?: new (init: { title: string }) => unknown })
      .MediaMetadata;
    if (session && Meta) session.metadata = new Meta({ title });
  }, [playing, title]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setFailed(true));
    } else {
      audio.pause();
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const end = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + seconds), end);
    setPosition(audio.currentTime);
  }, []);

  if (failed) {
    return (
      <StateMessage
        title={t('onlineCourses.audio.failedTitle')}
        body={t('onlineCourses.audio.failedHint')}
        actionLabel={onRetry ? t('onlineCourses.audio.retry') : undefined}
        onAction={
          onRetry
            ? () => {
                setFailed(false);
                onRetry();
              }
            : undefined
        }
      />
    );
  }

  if (!src) {
    return <StateMessage title={t('onlineCourses.audio.missingTitle')} body={t('onlineCourses.audio.missingHint')} />;
  }

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{t('onlineCourses.audio.kicker')}</Text>

      <View
        style={styles.track}
        role="progressbar"
        aria-label={t('onlineCourses.audio.progress')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <PressableRing
          onPress={() => skip(-SKIP_SECONDS)}
          style={styles.skip}
          aria-label={t('onlineCourses.audio.back', { seconds: SKIP_SECONDS })}
        >
          <Text style={styles.skipText}>−{SKIP_SECONDS} s</Text>
        </PressableRing>
        <PressableRing
          onPress={toggle}
          style={styles.play}
          aria-label={playing ? t('onlineCourses.audio.pause') : t('onlineCourses.audio.play')}
        >
          <Text style={styles.playText}>{playing ? t('onlineCourses.audio.pause') : t('onlineCourses.audio.play')}</Text>
        </PressableRing>
        <PressableRing
          onPress={() => skip(SKIP_SECONDS)}
          style={styles.skip}
          aria-label={t('onlineCourses.audio.forward', { seconds: SKIP_SECONDS })}
        >
          <Text style={styles.skipText}>+{SKIP_SECONDS} s</Text>
        </PressableRing>
      </View>

      {playing ? (
        <Text style={styles.awake} aria-live="polite">
          {t('onlineCourses.audio.keepAwake')}
        </Text>
      ) : (
        <Text style={styles.hint}>{t('onlineCourses.audio.keepAwakeHint')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink700,
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.sage700,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: colors.ink700,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  skip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink900,
  },
  play: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  playText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  awake: {
    fontSize: 13,
    color: colors.ocean700,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: colors.ink700,
    textAlign: 'center',
  },
});
