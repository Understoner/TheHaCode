import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { useThemePalette } from '@/design/theme';

// Schmuck der Startseite (01.11.2026, nur Testsystem). Rein dekorativ: alles
// hier ist fuer Screenreader ausgeblendet. Farben als Hex aus der Palette -
// als SVG-Attribut loest nicht jeder Browser var() sicher auf.

const PETALS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function useReduceMotion() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setReduce(on);
    });
    return () => {
      active = false;
    };
  }, []);
  return reduce;
}

/** Ein langsam drehendes Mandala - eine Umdrehung in 90 Sekunden. */
export function Mandala({ size = 230 }: { size?: number }) {
  const palette = useThemePalette();
  const reduce = useReduceMotion();
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) return;
    // Animated.loop statt setInterval: die Animation laeuft ueber
    // requestAnimationFrame und driftet nicht (CLAUDE.md, SAD §7.1).
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: 90_000, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      style={[styles.mandala, { width: size, height: size, transform: [{ rotate }] }]}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <G fill="none" stroke={palette.glow} strokeWidth={0.8}>
          <Circle cx={100} cy={100} r={18} />
          <Circle cx={100} cy={100} r={44} />
          <Circle cx={100} cy={100} r={78} />
          {PETALS.map((deg) => (
            <Ellipse key={deg} cx={100} cy={62} rx={14} ry={38} transform={`rotate(${deg} 100 100)`} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

const STARS: { x: number; y: number; r: number; tone: 'ink' | 'glow' | 'blossom' }[] = [
  { x: 10, y: 16, r: 1.6, tone: 'ink' },
  { x: 31, y: 8, r: 1.1, tone: 'ink' },
  { x: 54, y: 14, r: 0.9, tone: 'ink' },
  { x: 77, y: 22, r: 1.4, tone: 'glow' },
  { x: 90, y: 50, r: 1, tone: 'ink' },
  { x: 18, y: 60, r: 1.2, tone: 'blossom' },
  { x: 64, y: 70, r: 0.8, tone: 'ink' },
];

/** Ein paar Sterne hinter dem Kopf der Startseite - nur in Mondlicht. */
export function Stars() {
  const palette = useThemePalette();
  const tone = { ink: palette.ink900, glow: palette.glow, blossom: palette.blossom };
  // Punkte als kleine Kreise in Prozent der Breite und Hoehe: ein SVG mit
  // gedehnter viewBox wuerde sie auf breiten Fenstern zu Strichen ziehen.
  return (
    <View aria-hidden pointerEvents="none" style={styles.stars}>
      {STARS.map((s) => (
        <View
          key={`${s.x}-${s.y}`}
          style={[
            styles.star,
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.r * 2,
              height: s.r * 2,
              backgroundColor: tone[s.tone],
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * Ein Tag der Woche als Mond: neu (nichts erledigt) bis voll (alle Habits).
 * level wie im Tagebuch-Kalender, 0 bis 4 (stats.ts, heatDay).
 */
export function MoonPhaseGlyph({
  level,
  isFuture,
  isToday,
  size = 30,
}: {
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
  isToday: boolean;
  size?: number;
}) {
  const palette = useThemePalette();
  const lit = palette.glow;
  const dark = palette.line;
  // Die beleuchtete Seite waechst von rechts: Sichel, Halbmond, Dreiviertel.
  const lightPath: Record<1 | 2 | 3, string> = {
    1: 'M15 4a11 11 0 0 1 0 22a7 11 0 0 0 0-22z',
    2: 'M15 4a11 11 0 0 1 0 22z',
    3: 'M15 4a11 11 0 0 1 0 22a6 11 0 0 1 0-22z',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      {isFuture ? (
        <Circle cx={15} cy={15} r={10.5} fill="none" stroke={dark} strokeWidth={1.2} strokeDasharray="2 3" />
      ) : (
        <>
          <Circle cx={15} cy={15} r={11} fill={level === 4 ? lit : dark} />
          {level > 0 && level < 4 ? <Path d={lightPath[level as 1 | 2 | 3]} fill={lit} /> : null}
        </>
      )}
      {isToday ? <Circle cx={15} cy={15} r={13.6} fill="none" stroke={palette.blossom} strokeWidth={1.2} /> : null}
    </Svg>
  );
}

/** Kleine Zeichen fuer die drei Ritual-Kacheln, im Wechsel. */
export function RitualGlyph({ index }: { index: number }) {
  const palette = useThemePalette();
  const tones = [palette.sage700, palette.blossom, palette.glow];
  const color = tones[index % tones.length];
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" aria-hidden>
      {index % 3 === 0 ? (
        <>
          <Path
            d="M11 5h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6v-8a6 6 0 0 1 6-6z"
            fill="none"
            stroke={color}
            strokeWidth={1.6}
          />
          <Circle cx={15} cy={15} r={3} fill={color} />
        </>
      ) : index % 3 === 1 ? (
        <>
          <Path d="M3 15c4-6 8-6 12 0s8 6 12 0" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
          <Path
            d="M3 21c4-4 8-4 12 0s8 4 12 0"
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.6}
          />
        </>
      ) : (
        <>
          <Path
            d="M15 4c-5 7-5 13 0 22M15 4c5 7 5 13 0 22"
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Circle cx={15} cy={15} r={2} fill={color} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  mandala: {
    position: 'absolute',
    right: -70,
    top: -60,
    opacity: 0.5,
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
  },
  stars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
});
