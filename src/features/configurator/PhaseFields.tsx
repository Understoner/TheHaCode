import { Controller, useFieldArray, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/design/tokens';
import {
  EDITABLE_PHASE_KINDS,
  MAX_PHASES_PER_BLOCK,
  type SequenceFormValues,
  type SequenceValues,
} from '@/features/configurator/schema';

type Props = {
  // Alle drei Typparameter, nicht nur der erste: das Formular haelt Text, die
  // Pruefung liefert Zahlen zurueck (schema.ts). Ohne den dritten passt das
  // Control aus useForm hier nicht hinein.
  control: Control<SequenceFormValues, unknown, SequenceValues>;
  stepIndex: number;
};

/**
 * Die Phasen eines Blocks. Der Phasentyp wird ueber vier Schalter gewaehlt und
 * nicht ueber ein Auswahlmenue: es sind genau vier, sie stehen in der
 * Reihenfolge eines Atemzugs, und auf dem Handy ist ein Tippen weniger als ein
 * Menue oeffnen, scrollen, tippen. Ein <Picker> waere ausserdem eine neue
 * Abhaengigkeit (CLAUDE.md).
 */
export function PhaseFields({ control, stepIndex }: Props) {
  const { t } = useTranslation();
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: `steps.${stepIndex}.phases`,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('sequenz.phasen')}</Text>

      {fields.map((field, phaseIndex) => (
        <View key={field.id} style={styles.phase}>
          <Controller
            control={control}
            name={`steps.${stepIndex}.phases.${phaseIndex}.kind`}
            render={({ field: kindField }) => (
              <View style={styles.kindRow}>
                {EDITABLE_PHASE_KINDS.map((kind) => {
                  const active = kindField.value === kind;
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => kindField.onChange(kind)}
                      role="radio"
                      aria-checked={active}
                      style={[styles.kindChip, active && styles.kindChipActive]}
                    >
                      <Text style={[styles.kindText, active && styles.kindTextActive]}>
                        {t(`phase.${kind}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />

          <View style={styles.row}>
            <View style={styles.duration}>
              <Controller
                control={control}
                name={`steps.${stepIndex}.phases.${phaseIndex}.duration_seconds`}
                render={({ field: durationField, fieldState }) => (
                  <TextField
                    label={t('sequenz.dauer')}
                    value={durationField.value}
                    onChangeText={durationField.onChange}
                    onBlur={durationField.onBlur}
                    error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                    inputMode="decimal"
                  />
                )}
              />
            </View>

            <View style={styles.tools}>
              <Pressable
                disabled={phaseIndex === 0}
                aria-disabled={phaseIndex === 0}
                onPress={() => swap(phaseIndex, phaseIndex - 1)}
                aria-label={t('sequenz.nachOben')}
                style={[styles.tool, phaseIndex === 0 && styles.toolOff]}
              >
                <Text style={styles.toolText}>↑</Text>
              </Pressable>
              <Pressable
                disabled={phaseIndex === fields.length - 1}
                aria-disabled={phaseIndex === fields.length - 1}
                onPress={() => swap(phaseIndex, phaseIndex + 1)}
                aria-label={t('sequenz.nachUnten')}
                style={[styles.tool, phaseIndex === fields.length - 1 && styles.toolOff]}
              >
                <Text style={styles.toolText}>↓</Text>
              </Pressable>
              {/* Die letzte Phase laesst sich nicht entfernen - ein Block ohne
                  Phase waere nichts, was sich abspielen liesse, und die
                  Datenbank wiese ihn ohnehin ab (Migration 0009). */}
              <Pressable
                disabled={fields.length === 1}
                aria-disabled={fields.length === 1}
                onPress={() => remove(phaseIndex)}
                aria-label={t('sequenz.phaseEntfernen')}
                style={[styles.tool, fields.length === 1 && styles.toolOff]}
              >
                <Text style={styles.toolText}>✕</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}

      {fields.length < MAX_PHASES_PER_BLOCK ? (
        <Pressable
          onPress={() => append({ kind: 'inhale', duration_seconds: '4' })}
          style={styles.add}
        >
          <Text style={styles.addText}>{t('sequenz.phaseHinzufuegen')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phase: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kindChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  kindChipActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  kindText: {
    fontSize: 13,
    color: colors.ink700,
  },
  kindTextActive: {
    color: colors.ocean700,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  duration: {
    flex: 1,
    maxWidth: 200,
  },
  tools: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 22,
  },
  tool: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  // Kein opacity: das druecke den Kontrast unter 4,5:1 (CLAUDE.md). Die
  // ruhige Flaeche sagt dasselbe, ohne die Schrift unlesbar zu machen.
  toolOff: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  toolText: {
    fontSize: 15,
    color: colors.ink700,
  },
  add: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
