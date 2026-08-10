import { useState } from 'react';
import { Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import { colors, radius } from '@/design/tokens';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
};

// Gefuellter Primaer-Button (DESIGN.md: button-primary). Fuer wichtige
// Aktionen wie Kurs-Anmeldung oder spaeter Konfigurator-Speichern - keine
// neuen Textlink-CTAs mehr fuer diese Faelle (DESIGN.md, Do's and Don'ts).
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
    backgroundColor: colors.brand700,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  active: {
    backgroundColor: colors.brand800,
  },
  focusRing: {
    outlineColor: colors.brand700,
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  label: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '600',
  },
});
