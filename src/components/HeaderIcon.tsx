import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius } from '@/design/tokens';

// Runde Symbol-Knoepfe neben einer Seitenueberschrift (Tagebuch seit
// 30.10.2026, danach Kurse, Sessions und Habit-Auswahl). So hoch wie die
// Ueberschrift (28), die Trefferflaeche ueber hitSlop trotzdem 44 - deshalb
// stehen mehrere mit 16 Abstand nebeneinander (siehe HEADER_ICON_GAP).
// Gezeichnet mit react-native-svg; das Projekt hat keine Icon-Bibliothek.

export const HEADER_ICON_SIZE = 28;
export const HEADER_ICON_GAP = 16;
const GLYPH = 16;

export function HeaderIconLink({
  href,
  label,
  active = false,
  children,
}: {
  href: Href;
  label: string;
  /** Hervorgehoben, etwa wenn ein Filter gesetzt ist. */
  active?: boolean;
  children: ReactNode;
}) {
  return (
    // flatten: expo-router lehnt bei asChild ein Stil-Array ab.
    <Link href={href} asChild>
      <PressableRing
        role="link"
        aria-label={label}
        hitSlop={8}
        style={StyleSheet.flatten([styles.icon, active && styles.iconActive])}
      >
        {children}
      </PressableRing>
    </Link>
  );
}

/** Drei Balken auf einer Grundlinie. */
export function ChartGlyph() {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      <Rect x={2} y={8} width={3} height={6} rx={1} fill={colors.ink700} />
      <Rect x={6.5} y={3} width={3} height={11} rx={1} fill={colors.ink700} />
      <Rect x={11} y={6} width={3} height={8} rx={1} fill={colors.ink700} />
    </Svg>
  );
}

/** Ein Zahnrad: Ring mit acht Zaehnen. */
export function GearGlyph() {
  const teeth = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      {teeth.map((a) => (
        <Line
          key={a}
          x1={8 + Math.cos(a) * 4.5}
          y1={8 + Math.sin(a) * 4.5}
          x2={8 + Math.cos(a) * 7}
          y2={8 + Math.sin(a) * 7}
          stroke={colors.ink700}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={8} cy={8} r={4.2} fill="none" stroke={colors.ink700} strokeWidth={2.4} />
    </Svg>
  );
}

/** Ein Trichter. Aktiv in der Primaerfarbe. */
export function FilterGlyph({ active = false }: { active?: boolean }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      <Path
        d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z"
        fill={active ? colors.ocean700 : colors.ink700}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Eine Checkliste: Haken, darunter zwei Zeilen - die Habit-Auswahl. */
export function ChecklistGlyph() {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      <Path
        d="M2 4.5l1.8 1.8L7 3"
        fill="none"
        stroke={colors.ink700}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={9} y1={4.5} x2={14} y2={4.5} stroke={colors.ink700} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={9} x2={14} y2={9} stroke={colors.ink700} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={13} x2={14} y2={13} stroke={colors.ink700} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Eine Liste mit Punkten - die eigenen Sequenzen. */
export function ListGlyph() {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      {[3.5, 8, 12.5].map((y) => (
        <Circle key={`p${y}`} cx={3} cy={y} r={1.4} fill={colors.ink700} />
      ))}
      {[3.5, 8, 12.5].map((y) => (
        <Line key={`l${y}`} x1={6.5} y1={y} x2={14} y2={y} stroke={colors.ink700} strokeWidth={2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: HEADER_ICON_SIZE,
    height: HEADER_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  iconActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
});
