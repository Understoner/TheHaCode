import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';

// Ein Schieberegler, gebaut aus Reacts Native eigenen Responder-Props.
//
// React Native bringt seit Jahren keinen Slider mehr mit; der uebliche Weg
// waere @react-native-community/slider - eine neue Abhaengigkeit, und die
// braucht laut CLAUDE.md Ruecksprache. Fuer einen Lautstaerkeregler lohnt das
// nicht: onStartShouldSetResponder plus onResponderMove liefern in
// react-native-web sowohl Maus als auch Finger, und locationX ist bereits
// relativ zum Element. Damit sind es dreissig Zeilen statt eines Pakets.
//
// Bedienbar bleibt er auch ohne Ziehen: ein Tippen an eine Stelle der Bahn
// setzt den Wert dorthin.

type Props = {
  label: string;
  value: number; // 0..1
  onChange: (value: number) => void;
};

export function VolumeSlider({ label, value, onChange }: Props) {
  const [width, setWidth] = useState(0);

  const handle = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = event.nativeEvent.locationX;
    onChange(Math.min(1, Math.max(0, x / width)));
  };

  const prozent = Math.round(value * 100);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={styles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handle}
        onResponderMove={handle}
        role="slider"
        aria-label={label}
        aria-valuenow={prozent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <View style={styles.bar} />
        <View style={[styles.fill, { width: `${prozent}%` }]} />
        {/* Der Griff sitzt am Ende der Fuellung. marginLeft: -8 zentriert ihn
            auf dem Wert, statt ihn rechts daneben zu setzen. */}
        <View style={[styles.knobWrap, { left: `${prozent}%` }]}>
          <View style={styles.knob} />
        </View>
      </View>

      <Text style={styles.value}>{prozent}</Text>
    </View>
  );
}

const TRACK_HEIGHT = 4;
const KNOB = 16;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 58,
  },
  track: {
    flex: 1,
    height: KNOB + 8, // grosszuegige Trefferflaeche, die Bahn selbst ist duenn
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.line,
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  knobWrap: {
    position: 'absolute',
    marginLeft: -KNOB / 2,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.ocean700,
  },
  value: {
    fontSize: 11,
    color: colors.ink700,
    width: 26,
    textAlign: 'right',
  },
});
