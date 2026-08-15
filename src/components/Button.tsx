import { useState } from 'react';
import { Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import { colors, radius } from '@/design/tokens';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  /** Waehrend eines laufenden Absendens: nicht mehr ausloesbar, sichtbar ruhend. */
  disabled?: boolean;
  /** Ueber die volle Breite - in Formularen die uebliche Form. */
  block?: boolean;
};

// Gefuellter Pillen-Button (ui/references/*.svg). Fuer wichtige Aktionen wie
// Kurs-Anmeldung oder spaeter Konfigurator-Speichern.
export function Button({ label, onPress, disabled = false, block = false }: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // Ohne aria-disabled meldet ein Screenreader den Button weiterhin als
      // ausloesbar - Pressable schaltet nur das Antippen ab.
      aria-disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        !disabled && (hovered || pressed) && styles.active,
        focused && styles.focusRing,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: colors.ocean700,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  block: {
    alignSelf: 'stretch',
  },
  active: {
    backgroundColor: colors.ocean800,
  },
  // Kein opacity auf dem gefuellten Button: das druecke Weiss auf Ocean unter
  // die 4,5:1-Regel (CLAUDE.md). Stattdessen eine ruhige Flaeche mit dunkler
  // Schrift - deutlich als "gerade nicht" lesbar und trotzdem gut lesbar.
  disabled: {
    backgroundColor: colors.lineStrong,
  },
  focusRing: {
    outlineColor: colors.ocean700,
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  label: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '500',
  },
  labelDisabled: {
    color: colors.ink900,
  },
});
