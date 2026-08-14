import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, radius as radii } from '@/design/tokens';
import type { TimelineSegment } from '@/features/breathing/timeline';

// Schicht 3 der Breathing Engine (SAD §7.6), Werte aus
// ui/references/03_atem_animation.svg, Abschnitt "Aufbau und Werte".
//
// Zwei feste Ankerpunkte: Einatmen beginnt bei 6 Uhr, Ausatmen bei 12 Uhr.
// Daraus folgt, dass jede Haelfte 180 Grad umfasst und intern nach Dauer
// geteilt wird - bei 4-7-8 braucht die linke Haelfte 11 s, die rechte 8 s.
// Die Winkelgeschwindigkeit ist je Haelfte konstant, zwischen den Haelften
// aber unterschiedlich.
//
// Animiert werden ausschliesslich transform und opacity, und zwar ueber
// Animated statt ueber React-State: ein Re-Render je Phasenwechsel, nicht je
// Bild (BACKLOG T09).

const RADIUS_MIN = 0.55;
const RADIUS_MAX = 1.0;
const SIZE = 240;

/** Winkel am Ende der Phase, gemessen ab 6 Uhr im Uhrzeigersinn (0..360). */
function endAngleFor(seg: TimelineSegment, round: TimelineSegment[]): number {
  const dur = (kind: TimelineSegment['kind']) =>
    round.filter((s) => s.kind === kind).reduce((sum, s) => sum + s.durationMs, 0);

  const tIn = dur('inhale');
  const tHoldIn = dur('hold_in');
  const tOut = dur('exhale');
  const tHoldOut = dur('hold_out');

  // Linke Haelfte: Einatmen + Halten voll teilen sich 180 Grad nach Dauer.
  const aIn = tIn + tHoldIn > 0 ? (180 * tIn) / (tIn + tHoldIn) : 180;
  // Rechte Haelfte: Ausatmen + Halten leer teilen sich die zweiten 180 Grad.
  const aOut = tOut + tHoldOut > 0 ? (180 * tOut) / (tOut + tHoldOut) : 180;

  switch (seg.kind) {
    case 'inhale':
      return aIn;
    case 'hold_in':
      return 180;
    case 'exhale':
      return 180 + aOut;
    case 'hold_out':
      return 360;
    default:
      return 360;
  }
}

function startAngleFor(seg: TimelineSegment, round: TimelineSegment[]): number {
  switch (seg.kind) {
    case 'inhale':
      return 0;
    case 'hold_in':
      return endAngleFor({ ...seg, kind: 'inhale' }, round);
    case 'exhale':
      return 180;
    case 'hold_out':
      return endAngleFor({ ...seg, kind: 'exhale' }, round);
    default:
      return 0;
  }
}

function targetRadius(kind: TimelineSegment['kind']): number {
  switch (kind) {
    case 'inhale':
      return RADIUS_MAX;
    case 'hold_in':
      return RADIUS_MAX;
    case 'exhale':
      return RADIUS_MIN;
    case 'hold_out':
      return RADIUS_MIN;
    default:
      return (RADIUS_MIN + RADIUS_MAX) / 2;
  }
}

type Props = {
  segment: TimelineSegment | null;
  /** Alle Segmente der laufenden Runde - fuer die Winkelaufteilung. */
  round: TimelineSegment[];
  running: boolean;
};

export function BreathCircle({ segment, round, running }: Props) {
  // useState statt useRef: die Animated.Values sollen genau einmal entstehen,
  // aber ein ref darf waehrend des Renderns nicht gelesen werden.
  const [scale] = useState(() => new Animated.Value(RADIUS_MIN));
  const [angle] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setReduceMotion(on);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!segment) return;

    // Pause zwischen zwei Bloecken: der Ring ruht am kleinsten Radius und die
    // Marke parkt bei 6 Uhr - genau dort, wo das naechste Einatmen beginnt.
    if (segment.kind === 'rest') {
      scale.setValue(RADIUS_MIN);
      angle.setValue(0);
      return;
    }

    // prefers-reduced-motion: fester Radius, die Marke springt statt zu
    // laufen. Zaehler und Beschriftung laufen normal weiter (BACKLOG T09).
    if (reduceMotion) {
      scale.setValue((RADIUS_MIN + RADIUS_MAX) / 2);
      angle.setValue(endAngleFor(segment, round));
      return;
    }

    const from = startAngleFor(segment, round);
    const to = endAngleFor(segment, round);
    angle.setValue(from);
    scale.stopAnimation();

    const anims = [
      Animated.timing(angle, {
        toValue: to,
        duration: segment.durationMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ];

    // Beim Halten bleibt der Radius stehen - nur die Marke laeuft weiter.
    const isHold = segment.kind === 'hold_in' || segment.kind === 'hold_out';
    if (!isHold) {
      anims.push(
        Animated.timing(scale, {
          toValue: targetRadius(segment.kind),
          duration: segment.durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        })
      );
    } else {
      scale.setValue(targetRadius(segment.kind));
    }

    const group = Animated.parallel(anims);
    if (running) group.start();

    return () => group.stop();
  }, [segment, round, running, scale, angle, reduceMotion]);

  const rotate = angle.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  // Die Marke laeuft AUF dem Ring, nicht auf einer festen Bahn daneben: der
  // Wrapper wird mit demselben Wert skaliert wie der Ring, dadurch wandert der
  // Punkt beim Ausatmen nach innen und beim Einatmen wieder nach aussen.
  // Damit er dabei nicht selbst kleiner und groesser wird, bekommt er die
  // Gegenskalierung - 1/scale hebt die Skalierung des Wrappers exakt auf.
  const markerCounterScale = Animated.divide(1, scale);

  const toneOfPhase =
    segment?.kind === 'rest'
      ? colors.ink500
      : segment?.kind === 'exhale' || segment?.kind === 'hold_out'
        ? colors.sage500
        : colors.ocean500;

  return (
    <View style={styles.box}>
      {/* Ruhige Bahn, auf der die Marke laeuft */}
      <View style={styles.track} />

      <Animated.View
        testID="breath-ring"
        style={[styles.ring, { borderColor: toneOfPhase, transform: [{ scale }] }]}
      />

      {/* Die Marke sitzt bei 6 Uhr im Wrapper; gedreht UND skaliert wird der
          Wrapper, damit sie dem Ring folgt. */}
      <Animated.View style={[styles.markerWrap, { transform: [{ rotate }, { scale }] }]}>
        <Animated.View
          testID="breath-marker"
          style={[
            styles.marker,
            { backgroundColor: toneOfPhase, transform: [{ scale: markerCounterScale }] },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
  },
  markerWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    marginBottom: -6,
  },
});
