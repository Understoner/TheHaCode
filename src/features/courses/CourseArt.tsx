import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useThemePalette } from '@/design/theme';
import { palettes, type Palette } from '@/design/tokens';
import type { CourseKind, CourseTheme } from '@/features/courses/courseFacts';

// Zeichen, Farben und Bild der Kurse im Vorschlag "Mondlicht Mobile"
// (03.11.2026, nur Testsystem). Wie bei den News: keine Fotos, nur Formen aus
// der Palette. SVG-Farben als Hex (var() loest als SVG-Attribut nicht jeder
// Browser auf, siehe Lotus.tsx).

const THEME_ICON: Record<CourseTheme, string> = {
  balance: 'M12 4v16M5 9h14M7 9l-3 6h6zM17 9l-3 6h6z',
  energy: 'M13 3L5 14h6l-1 7 8-11h-6z',
  relax: 'M3 10c3-3 6-3 9 0s6 3 9 0M3 16c3-3 6-3 9 0s6 3 9 0',
  funktional: 'M12 3c-4 5-4 11 0 18M12 3c4 5 4 11 0 18M4 12c4-2 12-2 16 0',
};

export const KIND_ICON: Record<CourseKind, string> = {
  online: 'M4 5h16v11H4zM9 20h6M12 16v4',
  vorort: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11a2 2 0 1 0 0-4a2 2 0 0 0 0 4z',
  mass: 'M12 3c-4 5-4 11 0 18M12 3c4 5 4 11 0 18M4 12c4-2 12-2 16 0',
};

const CALENDAR_ICON = 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4';

/**
 * Farbe fuer Zeichen UND Schrift - nur Toene ueber 4,5:1 (CLAUDE.md), wie
 * bei categoryTone() der News: das Lotusrosa nur in Mondlicht.
 */
export function courseTone(kind: CourseKind, theme: CourseTheme | null, palette: Palette): string {
  const mond = palette === palettes.mondlicht;
  if (kind !== 'online') return mond ? palette.blossom : palette.ink700;
  if (theme === 'balance') return palette.sage700;
  if (theme === 'relax') return palette.ink700;
  if (theme === 'funktional') return mond ? palette.blossom : palette.sage700;
  return palette.ocean700;
}

export function courseIconPath(kind: CourseKind, theme: CourseTheme | null): string {
  if (kind === 'online' && theme) return THEME_ICON[theme];
  return kind === 'online' ? KIND_ICON.online : CALENDAR_ICON;
}

export function Glyph({ d, color, size = 18, strokeWidth = 1.8 }: { d: string; color: string; size?: number; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Das Bild oben auf der Kursseite, wie im Vorschlag: Vollmond mit Hof, ein
 * Nebelband und eine Reihe Baeume am Horizont.
 */
export function CourseScene({ style }: { style?: StyleProp<ViewStyle> }) {
  const palette = useThemePalette();
  const W = 390;
  const H = 196;
  return (
    <View style={[styles.frame, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Rect width={W} height={H} fill={palette.oceanImageBg} />
        <Circle cx={292} cy={58} r={44} fill={palette.glow} opacity={0.08} />
        <Circle cx={292} cy={58} r={26} fill={palette.glow} opacity={0.14} />
        <Circle cx={292} cy={58} r={15} fill={palette.glow} />
        {[
          [44, 30, 1.3],
          [120, 52, 1],
          [176, 22, 1.2],
          [352, 40, 1],
        ].map(([x, y, r]) => (
          <Circle key={`${x}`} cx={x} cy={y} r={r} fill={palette.ink900} opacity={0.7} />
        ))}
        <Rect x={-20} y={118} width={430} height={26} rx={13} fill={palette.glow} opacity={0.07} />
        <Rect x={40} y={140} width={330} height={18} rx={9} fill={palette.glow} opacity={0.06} />
        <Path
          d="M30 196 L52 86 L74 196Z M70 196 L96 60 L122 196Z M150 196 L168 104 L186 196Z M210 196 L236 70 L262 196Z M330 196 L352 92 L374 196Z"
          fill={palette.surface}
        />
        <Path
          d="M0 196 L18 120 L36 196Z M112 196 L132 112 L152 196Z M262 196 L284 118 L306 196Z M360 196 L378 128 L396 196Z"
          fill={palette.lineStrong}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    position: 'relative',
  },
});
