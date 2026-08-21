import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

// Ein Haken. react-native-web bringt keinen mit, und eine Bibliothek fuer ein
// Quadrat mit Rahmen waere keine (CLAUDE.md §Stack).
//
// role und aria-checked machen ihn fuer Screenreader zu dem, was er ist;
// PressableRing gibt ihm den sichtbaren Tastaturfokus. Die Beschriftung kommt
// als children, weil in ihr Links stehen - "Ich habe die AGB gelesen" mit AGB
// als Verweis laesst sich nicht als String uebergeben.
export function Checkbox({
  checked,
  onToggle,
  label,
  children,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  /** Fuer Screenreader, wenn die sichtbare Beschriftung Links enthaelt. */
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <View style={styles.wrap}>
      <PressableRing
        onPress={onToggle}
        role="checkbox"
        aria-checked={checked}
        accessibilityLabel={label}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked, Boolean(error) && styles.boxError]}>
          {checked ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={styles.label}>{children}</Text>
      </PressableRing>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  boxError: {
    borderColor: colors.danger,
  },
  tick: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.surface,
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
});
