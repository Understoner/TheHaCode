import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useThemePalette } from '@/design/theme';
import { palettes, type Palette } from '@/design/tokens';
import { useReduceMotion } from '@/design/useReduceMotion';
import type { ExerciseEffect } from '@/features/sessions/effects';
import { profilePath, type Mood, type ProfilePhase, type SessionKind } from '@/features/sessions/moods';

// Zeichen der Sessions im Vorschlag "Mondlicht Mobile" (02.11.2026, nur
// Testsystem). SVG-Farben als Hex aus der Palette (var() loest als
// SVG-Attribut nicht jeder Browser auf, siehe Lotus.tsx).

/** Ton einer Wirkung - fuer Symbole und Kurve. */
export function effectTone(effect: ExerciseEffect, palette: Palette): string {
  const mond = palette === palettes.mondlicht;
  if (effect === 'aktivierend') return palette.ocean700;
  if (effect === 'entspannend') return palette.sage700;
  if (effect === 'stressreduktion') return mond ? palette.blossom : palette.sage700;
  return palette.ink700;
}

const EFFECT_ICON: Record<ExerciseEffect, string> = {
  aktivierend:
    'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
  entspannend: 'M3 10c3-3 6-3 9 0s6 3 9 0M3 16c3-3 6-3 9 0s6 3 9 0',
  stressreduktion: 'M12 3c-4 5-4 11 0 18M12 3c4 5 4 11 0 18',
  co2_toleranz: 'M8 15a3 3 0 1 0 0.01 0M15 8a4 4 0 1 0 0.01 0M17 17a2 2 0 1 0 0.01 0',
};

export function EffectGlyph({ effect, size = 14 }: { effect: ExerciseEffect; size?: number }) {
  const palette = useThemePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={EFFECT_ICON[effect]} fill="none" stroke={effectTone(effect, palette)} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const MOOD_ICON: Record<Mood, string> = {
  wach: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z',
  fokus: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 11.5v1',
  ruhig: 'M3 10c3-3 6-3 9 0s6 3 9 0M3 16c3-3 6-3 9 0s6 3 9 0',
  schlafen: 'M17 3a9 9 0 1 0 4 13A7 7 0 0 1 17 3z',
};

export function MoodGlyph({ mood, color, size = 24 }: { mood: Mood; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={MOOD_ICON[mood]} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 2" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function PlayGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M7 4l13 8-13 8z" fill={color} />
    </Svg>
  );
}

const CURVE = { width: 72, height: 40, padX: 4, padY: 8 };

/**
 * Die Atemform einer Box-Session als Kurve, mit einem Punkt, der im echten
 * Takt darueber laeuft (eine Runde). Bei weniger Bewegung steht er am Anfang.
 * Aufnahmen bekommen statt der Kurve ihr Zeichen: Kopfhoerer oder Bildrahmen.
 */
export function SessionThumb({
  kind,
  phases,
  tone,
}: {
  kind: SessionKind;
  phases: readonly ProfilePhase[];
  tone: string;
}) {
  const palette = useThemePalette();
  return (
    <View style={[styles.thumb, { backgroundColor: palette.oceanImageBg }]}>
      {kind === 'box' ? (
        <BreathCurve phases={phases} tone={tone} dot={palette.ink900} />
      ) : (
        <Svg width={CURVE.width} height={CURVE.height} viewBox="0 0 72 40" aria-hidden>
          {kind === 'audio' ? (
            <Path
              d="M26 26v-5a10 10 0 0 1 20 0v5M26 24h3v8h-3zM43 24h3v8h-3z"
              fill="none"
              stroke={tone}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <>
              <Rect x={22} y={10} width={28} height={20} rx={4} fill="none" stroke={tone} strokeWidth={1.8} />
              <Path d="M33 15.5l7 4.5-7 4.5z" fill={tone} />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

function BreathCurve({ phases, tone, dot }: { phases: readonly ProfilePhase[]; tone: string; dot: string }) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const d = useMemo(() => profilePath(phases, CURVE), [phases]);
  const totalMs = phases.reduce((sum, p) => sum + p.seconds, 0) * 1000;

  // Die Stuetzpunkte der Kurve sind dieselben wie die des Punktes: dieselbe
  // Rechnung, als Eingabebereich die Zeitanteile der Phasen.
  const points = useMemo(() => {
    const coords = d
      .split(/[ML]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((pair) => pair.split(' ').map(Number) as [number, number]);
    const total = phases.reduce((sum, p) => sum + p.seconds, 0);
    const input = phases.reduce<number[]>((list, p) => [...list, list[list.length - 1] + p.seconds / total], [0]);
    return { coords, input };
  }, [d, phases]);

  useEffect(() => {
    if (reduce || totalMs <= 0) return;
    // Reine Anzeige, nichts Zeitkritisches: die Schleife darf ruhig driften
    // (die Uebung selbst laeuft ueber die Ankeruhr, SAD §7.1).
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: totalMs, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, totalMs, progress]);

  if (!d || points.coords.length !== points.input.length) {
    return <View style={{ width: CURVE.width, height: CURVE.height }} />;
  }

  const left = progress.interpolate({ inputRange: points.input, outputRange: points.coords.map((c) => c[0] - 4) });
  const top = progress.interpolate({ inputRange: points.input, outputRange: points.coords.map((c) => c[1] - 4) });

  return (
    <View style={{ width: CURVE.width, height: CURVE.height }}>
      <Svg width={CURVE.width} height={CURVE.height} viewBox="0 0 72 40" aria-hidden>
        <Path d={d} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.dot, { backgroundColor: dot, left, top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: CURVE.width,
    height: CURVE.height,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
