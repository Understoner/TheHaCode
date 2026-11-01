import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';

import { useThemePalette } from '@/design/theme';

// Die Lotusbluete im Atemkreis, nur in der Darstellung Mondlicht
// (01.11.2026, nur Testsystem). Sie folgt dem Skalierungswert des Rings aus
// BreathCircle und rechnet selbst nichts: oeffnet sich der Ring beim
// Einatmen, oeffnet sich die Bluete mit.
//
// Farben als Hex aus der Palette: als SVG-Attribut loest nicht jeder Browser
// var() sicher auf.

const OUTER = [0, 45, 90, 135, 180, 225, 270, 315];
const INNER = OUTER.map((deg) => deg + 22.5);

export function Lotus({ scale, size, innerDiameter }: { scale: Animated.Value; size: number; innerDiameter: number }) {
  const palette = useThemePalette();
  // Der aeussere Kranz oeffnet sich etwas weiter als der innere.
  const outerScale = scale.interpolate({ inputRange: [0.55, 1], outputRange: [0.62, 1.02] });

  return (
    <View aria-hidden pointerEvents="none" style={[styles.layer, { width: size, height: size }]}>
      <Animated.View style={[styles.layer, { width: size, height: size, transform: [{ scale: outerScale }] }]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <G fill={palette.blossom} fillOpacity={0.14} stroke={palette.blossom} strokeOpacity={0.55} strokeWidth={0.6}>
            {OUTER.map((deg) => (
              <Ellipse key={deg} cx={100} cy={52} rx={20} ry={46} transform={`rotate(${deg} 100 100)`} />
            ))}
          </G>
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, { width: size, height: size, transform: [{ scale }] }]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <G fill={palette.glow} fillOpacity={0.2} stroke={palette.glow} strokeWidth={0.8}>
            {INNER.map((deg) => (
              <Ellipse key={deg} cx={100} cy={64} rx={15} ry={36} transform={`rotate(${deg} 100 100)`} />
            ))}
          </G>
        </Svg>
      </Animated.View>
      {/* Ruhiger Grund unter der Schrift, damit "EIN"/"AUS" auf den
          Bluetenblaettern lesbar bleibt. Skaliert nicht mit. */}
      <View style={[styles.layer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={innerDiameter / 2} fill={palette.background} fillOpacity={0.85} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
