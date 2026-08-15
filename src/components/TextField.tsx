import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  /** Bereits uebersetzter Text, leer wenn das Feld in Ordnung ist. */
  error?: string;
} & Pick<
  TextInputProps,
  'secureTextEntry' | 'autoComplete' | 'inputMode' | 'autoCapitalize' | 'autoCorrect' | 'placeholder'
>;

// Ein Eingabefeld nach den Tokens: Abgrenzung ueber eine 1-px-Linie, kein
// Schatten (CLAUDE.md). Der Fehlertext steht unter dem Feld und nicht als
// Umrandungsfarbe allein - Farbe allein waere fuer Farbenblinde keine Information.
export function TextField({ label, error, ...input }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          input.onBlur();
        }}
        aria-label={label}
        aria-invalid={Boolean(error)}
        placeholderTextColor={colors.ink500}
        style={[styles.input, focused && styles.inputFocused, Boolean(error) && styles.inputError]}
      />
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    alignSelf: 'stretch',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink900,
    // Der Browser-Fokusring passt nicht zu den uebrigen Bedienelementen; der
    // eigene steht unten in inputFocused (gleiche Form wie in Button.tsx).
    outlineWidth: 0,
  },
  inputFocused: {
    borderColor: colors.ocean700,
    outlineColor: colors.ocean700,
    outlineOffset: 1,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
