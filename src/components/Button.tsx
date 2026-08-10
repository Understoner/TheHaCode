import { useState } from 'react';
import { Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import { colors, radius } from '@/design/tokens';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
};

// Gefuellter Pillen-Button (ui/references/*.svg). Fuer wichtige Aktionen wie
// Kurs-Anmeldung oder spaeter Konfigurator-Speichern.
export function Button({ label, onPress }: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.base, (hovered || pressed) && styles.active, focused && styles.focusRing]}
    >
      <Text style={styles.label}>{label}</Text>
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
  active: {
    backgroundColor: colors.ocean800,
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
});
