import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useThemeName, useThemePalette } from '@/design/theme';
import { palettes, type Palette } from '@/design/tokens';
import type { NewsCategory } from '@/features/news/categories';
import { supabase } from '@/lib/supabase';

// Bilder der News im Vorschlag "Mondlicht Mobile" (02.11.2026, nur
// Testsystem).
//
// - Ein gepflegtes Foto erscheint in Mondlicht als Duoton: erst grau, dann
//   mit Gold multipliziert und mit Nachtblau aufgehellt. So brechen helle
//   Stockfotos das Nachtblau nicht mehr. In "Klar" bleibt das Foto, wie es ist.
// - Ohne Foto zeichnet die App ein Motiv je Kategorie - kein Stockfoto, keine
//   erfundene Illustration, nur Formen aus der Palette.
//
// SVG-Farben als Hex aus der Palette (var() loest als SVG-Attribut nicht
// jeder Browser auf, siehe Lotus.tsx).

/**
 * Farbe einer Kategorie - fuer Zeichen UND Schrift, deshalb nur Toene ueber
 * 4,5:1 (CLAUDE.md): ocean700 und sage700 in beiden Darstellungen, das
 * Lotusrosa nur in Mondlicht (dort ~7:1 auf dem Grund), in "Klar" ink700.
 */
export function categoryTone(category: NewsCategory, palette: Palette): string {
  if (category === 'kurs') return palette.sage700;
  if (category === 'allgemein') return palette === palettes.mondlicht ? palette.blossom : palette.ink700;
  return palette.ocean700;
}

/** Kleines Kategoriesymbol fuer Leiste und Pille. */
export function CategoryGlyph({
  category,
  color,
  size = 18,
}: {
  category: NewsCategory | 'all';
  color: string;
  size?: number;
}) {
  const d: Record<NewsCategory | 'all', string> = {
    all: 'M4 6h16M4 12h16M4 18h16',
    praxis: 'M12 3c-4 5-4 11 0 18M12 3c4 5 4 11 0 18',
    blog: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
    kurs: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
    allgemein: 'M17 3a9 9 0 1 0 4 13A7 7 0 0 1 17 3z',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={d[category]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Das gezeichnete Motiv: Grund, Zeichen der Kategorie, drei Atemwellen. */
function Motif({ category, compact }: { category: NewsCategory; compact: boolean }) {
  const palette = useThemePalette();
  const tone = categoryTone(category, palette);
  // Feste Zeichenflaeche; preserveAspectRatio "slice" fuellt jedes Format.
  const W = compact ? 48 : 358;
  const H = compact ? 48 : 172;
  const cx = compact ? 24 : 262;
  const cy = compact ? 22 : 62;
  const r = compact ? 11 : 26;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <Rect width={W} height={H} fill={palette.oceanImageBg} />
      {compact ? null : (
        <>
          <Circle cx={cx} cy={cy} r={r * 1.8} fill={tone} opacity={0.07} />
          <Circle cx={cx} cy={cy} r={r * 1.2} fill={tone} opacity={0.1} />
          <Circle cx={40} cy={30} r={1.4} fill={palette.ink900} opacity={0.7} />
          <Circle cx={120} cy={18} r={1} fill={palette.ink900} opacity={0.5} />
          <Circle cx={190} cy={44} r={1.3} fill={palette.blossom} opacity={0.8} />
          <Circle cx={320} cy={20} r={1} fill={palette.ink900} opacity={0.5} />
        </>
      )}
      {category === 'allgemein' ? (
        <Path
          d={`M${cx + r * 0.25} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.5} ${r * 1.5} ${r * 0.8} ${r * 0.8} 0 0 1 ${-r * 0.5} ${-r * 1.5}z`}
          fill={tone}
        />
      ) : null}
      {category === 'kurs' ? (
        <>
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeWidth={compact ? 1.5 : 2} />
          <Circle cx={cx} cy={cy} r={r * 0.35} fill={tone} />
        </>
      ) : null}
      {category === 'praxis' ? (
        <Path
          d={`M${cx} ${cy - r}c${-r * 0.55} ${r * 0.7} ${-r * 0.55} ${r * 1.4} 0 ${r * 2}M${cx} ${cy - r}c${r * 0.55} ${r * 0.7} ${r * 0.55} ${r * 1.4} 0 ${r * 2}M${cx - r} ${cy}c${r * 0.5} ${-r * 0.25} ${r * 1.5} ${-r * 0.25} ${r * 2} 0`}
          fill="none"
          stroke={tone}
          strokeWidth={compact ? 1.5 : 2}
          strokeLinecap="round"
        />
      ) : null}
      {category === 'blog' ? (
        <Path
          d={[0, 1, 2, 3]
            .map((i) => {
              const x = cx - r * 0.75 + i * r * 0.5;
              const h = [0.9, 1.4, 0.7, 1.15][i] * r;
              return `M${x.toFixed(1)} ${(cy + r).toFixed(1)}V${(cy + r - h).toFixed(1)}`;
            })
            .join('')}
          stroke={tone}
          strokeWidth={compact ? 2 : 3}
          strokeLinecap="round"
        />
      ) : null}
      {[0, 1, 2].map((i) => {
        const base = compact ? 36 + i * 4 : 124 + i * 16;
        const amp = compact ? 3 : 8;
        return (
          <Path
            key={i}
            d={`M0 ${base} C ${W * 0.17} ${base - amp}, ${W * 0.34} ${base + amp}, ${W * 0.5} ${base} S ${W * 0.84} ${base - amp}, ${W} ${base}`}
            fill="none"
            stroke={tone}
            strokeOpacity={[0.45, 0.3, 0.18][i]}
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
}

/** Titelbild eines Beitrags: Foto (in Mondlicht als Duoton) oder Motiv. */
export function NewsCover({
  path,
  category,
  label,
  compact = false,
  style,
}: {
  path: string | null;
  category: NewsCategory;
  label: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useThemeName();
  const palette = useThemePalette();
  const url = path ? supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl : null;

  return (
    <View style={[styles.frame, style]} accessibilityLabel={label}>
      {url ? (
        <>
          <Image
            source={{ uri: url }}
            style={[
              StyleSheet.absoluteFill,
              theme === 'mondlicht' ? ({ filter: 'grayscale(1) contrast(1.1)' } as object) : null,
            ]}
          />
          {theme === 'mondlicht' ? (
            <>
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: palette.glow, mixBlendMode: 'multiply' } as object]}
              />
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: palette.background, mixBlendMode: 'lighten' } as object]}
              />
            </>
          ) : null}
        </>
      ) : (
        <Motif category={category} compact={compact} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    position: 'relative',
  },
});
