import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

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
const RING_WIDTH = 2;

// Die Beschriftung im Kreis ("EIN", darunter "NASE"). Sie wird NICHT
// mitskaliert - sie soll lesbar bleiben - und muss deshalb in den Ring passen,
// wenn er am kleinsten ist. Ein Rechteck passt in einen Kreis, wenn seine
// Diagonale nicht laenger ist als der Durchmesser: bei 104 x 50 sind das rund
// 115 px, innen hat der kleinste Ring 128 px.
//
// Die Hoehe ergibt sich aus den beiden Zeilen unten: 30 (Phase) + 2 + 16 (Weg).
// Die Breite haelt, weil die Worte kurz sind - "HALTE" und "PAUSE" in 26 px,
// "LIPPENBREMSE" in 11 px. BreathCircle.test.ts prueft beides, damit ein
// laengeres Wort in der Uebersetzungsdatei auffaellt und nicht erst am Rand.
export const INNER_DIAMETER_MIN = SIZE * RADIUS_MIN - 2 * RING_WIDTH;
export const LABEL_MAX_WIDTH = 104;
export const LABEL_MAX_HEIGHT = 50;

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
  /** Was jetzt dran ist, kurz: "Ein", "Halte". Erscheint in Grossbuchstaben. */
  label?: string | null;
  /** Wodurch die Luft geht: "Nase", "Mund". Fehlt beim Halten. */
  sublabel?: string | null;
};

export function BreathCircle({ segment, round, running, label, sublabel }: Props) {
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

  // Dieselbe Farbfamilie wie der Ring, aber der 700er-Ton: 500er sind fuer
  // Text zu kontrastarm (CLAUDE.md).
  const textOfPhase =
    segment?.kind === 'rest'
      ? colors.ink700
      : segment?.kind === 'exhale' || segment?.kind === 'hold_out'
        ? colors.sage700
        : colors.ocean700;

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

      {label ? (
        <View style={styles.label} pointerEvents="none">
          {/* numberOfLines: sollte ein Wort doch zu breit sein, wird es
              gekuerzt statt ueber den Ring zu laufen. */}
          <Text testID="breath-label" numberOfLines={1} style={[styles.phase, { color: textOfPhase }]}>
            {label}
          </Text>
          {sublabel ? (
            <Text testID="breath-sublabel" numberOfLines={1} style={styles.route}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      ) : null}
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
    borderWidth: RING_WIDTH,
  },
  label: {
    position: 'absolute',
    maxWidth: LABEL_MAX_WIDTH,
    maxHeight: LABEL_MAX_HEIGHT,
    alignItems: 'center',
    gap: 2,
  },
  phase: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  route: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.ink700,
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
