import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/design/tokens';
import { PhaseFields } from '@/features/configurator/PhaseFields';
import { previewDurationMs, previewRhythm } from '@/features/configurator/preview';
import {
  MAX_BLOCKS,
  emptySequence,
  newStep,
  sequenceSchema,
  type SequenceFormValues,
  type SequenceValues,
} from '@/features/configurator/schema';
import { useSaveSequence } from '@/features/configurator/useSequences';
import type { PlayableExercise } from '@/types/breathing';
import { PressableRing } from '@/components/PressableRing';

/** Bestehende Sequenz -> Formularstand. Zahlen werden zu Text, sonst nichts. */
function toForm(sequence: PlayableExercise): SequenceFormValues {
  const zahl = (value: number | string | null) => {
    const n = Number(value ?? 0);
    return Number.isInteger(n) ? String(n) : String(n);
  };

  return {
    title: sequence.title,
    subtitle: sequence.subtitle ?? '',
    steps: [...sequence.exercise_steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => ({
        label: step.label ?? '',
        repeat_count: zahl(step.repeat_count),
        rest_seconds: zahl(step.rest_seconds),
        phases: [...step.exercise_phases]
          .sort((a, b) => a.position - b.position)
          .map((phase) => ({
            // Der Editor kennt vier Phasentypen; free_breathing gibt es nur
            // redaktionell. Faende sich einer, waere die Auswahl leer - dann
            // lieber sichtbar auf Einatmen stellen als still nichts anzeigen.
            kind: phase.kind === 'free_breathing' ? ('inhale' as const) : phase.kind,
            duration_seconds: zahl(phase.duration_seconds),
          })),
      })),
  };
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function SequenceEditor({ sequence }: { sequence?: PlayableExercise }) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveSequence();
  const [formError, setFormError] = useState<string | null>(null);
  // Einmal berechnet: sonst bekaeme das Formular bei jedem Rendern neue
  // Anfangswerte und setzte die Eingaben zurueck.
  const [defaults] = useState<SequenceFormValues>(() =>
    sequence ? toForm(sequence) : emptySequence()
  );

  const { control, handleSubmit, formState } = useForm<
    SequenceFormValues,
    unknown,
    SequenceValues
  >({
    resolver: zodResolver(sequenceSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const steps = useFieldArray({ control, name: 'steps' });

  // Die Vorschau haengt am ganzen Formular: jede Aenderung an einer Dauer
  // aendert die Gesamtzeit.
  //
  // useWatch statt watch(): watch() gibt bei jedem Rendern eine neue Funktion
  // zurueck, die der React Compiler nicht memoisieren kann - er ueberspringt
  // dann die ganze Komponente. useWatch abonniert dasselbe, ist aber ein Hook
  // mit stabilem Ergebnis.
  const live = useWatch({ control, defaultValue: defaults });

  const onSubmit = async (values: SequenceValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: sequence?.id ?? null, values });
      router.replace('/sequenzen');
    } catch {
      // Die Datenbank ist die letzte Instanz - Mengenlimit, Bezahlschranke,
      // Grenzwerte. Was hier ankommt, hat das Formular nicht vorher gesehen.
      setFormError(t('errors:sequenz.speichern'));
    }
  };

  const fieldError = (message?: string) => (message ? t(message) : undefined);

  return (
    <View style={styles.form}>
      <View style={styles.card}>
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <TextField
              label={t('sequenz.titel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldError(fieldState.error?.message)}
              placeholder={t('sequenz.titelPlatzhalter')}
            />
          )}
        />
        <Controller
          control={control}
          name="subtitle"
          render={({ field, fieldState }) => (
            <TextField
              label={t('sequenz.untertitel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldError(fieldState.error?.message)}
              placeholder={t('sequenz.untertitelPlatzhalter')}
            />
          )}
        />
      </View>

      {steps.fields.map((field, stepIndex) => (
        <View key={field.id} style={styles.card}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>
              {t('sequenz.block', { nummer: stepIndex + 1 })}
            </Text>
            <View style={styles.tools}>
              <PressableRing
                disabled={stepIndex === 0}
                aria-disabled={stepIndex === 0}
                onPress={() => steps.swap(stepIndex, stepIndex - 1)}
                aria-label={t('sequenz.nachOben')}
                style={[styles.tool, stepIndex === 0 && styles.toolOff]}
              >
                <Text style={styles.toolText}>↑</Text>
              </PressableRing>
              <PressableRing
                disabled={stepIndex === steps.fields.length - 1}
                aria-disabled={stepIndex === steps.fields.length - 1}
                onPress={() => steps.swap(stepIndex, stepIndex + 1)}
                aria-label={t('sequenz.nachUnten')}
                style={[styles.tool, stepIndex === steps.fields.length - 1 && styles.toolOff]}
              >
                <Text style={styles.toolText}>↓</Text>
              </PressableRing>
              <PressableRing
                disabled={steps.fields.length === 1}
                aria-disabled={steps.fields.length === 1}
                onPress={() => steps.remove(stepIndex)}
                aria-label={t('sequenz.blockEntfernen')}
                style={[styles.tool, steps.fields.length === 1 && styles.toolOff]}
              >
                <Text style={styles.toolText}>✕</Text>
              </PressableRing>
            </View>
          </View>

          <Controller
            control={control}
            name={`steps.${stepIndex}.label`}
            render={({ field: labelField, fieldState }) => (
              <TextField
                label={t('sequenz.blockName')}
                value={labelField.value}
                onChangeText={labelField.onChange}
                onBlur={labelField.onBlur}
                error={fieldError(fieldState.error?.message)}
                placeholder={t('sequenz.blockNamePlatzhalter')}
              />
            )}
          />

          <View style={styles.pairRow}>
            <View style={styles.pairItem}>
              <Controller
                control={control}
                name={`steps.${stepIndex}.repeat_count`}
                render={({ field: roundsField, fieldState }) => (
                  <TextField
                    label={t('sequenz.runden')}
                    value={roundsField.value}
                    onChangeText={roundsField.onChange}
                    onBlur={roundsField.onBlur}
                    error={fieldError(fieldState.error?.message)}
                    inputMode="numeric"
                  />
                )}
              />
            </View>
            <View style={styles.pairItem}>
              <Controller
                control={control}
                name={`steps.${stepIndex}.rest_seconds`}
                render={({ field: restField, fieldState }) => (
                  <TextField
                    label={t('sequenz.pause')}
                    value={restField.value}
                    onChangeText={restField.onChange}
                    onBlur={restField.onBlur}
                    error={fieldError(fieldState.error?.message)}
                    inputMode="decimal"
                  />
                )}
              />
            </View>
          </View>

          <PhaseFields control={control} stepIndex={stepIndex} />
        </View>
      ))}

      {steps.fields.length < MAX_BLOCKS ? (
        <PressableRing onPress={() => steps.append(newStep())} style={styles.addBlock}>
          <Text style={styles.addBlockText}>{t('sequenz.blockHinzufuegen')}</Text>
        </PressableRing>
      ) : null}

      {/* Die Vorschau rechnet mit derselben Engine, die der Player spaeter
          abspielt (siehe preview.ts) - was hier steht, kommt auch heraus. */}
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>{t('sequenz.vorschau')}</Text>
        <Text style={styles.previewValue}>
          {t('sequenz.gesamtdauer', { dauer: mmss(previewDurationMs(live)) })}
          {previewRhythm(live) ? ` · ${t('sessions.rhythm', { pattern: previewRhythm(live) })}` : ''}
        </Text>
      </View>

      {formError ? (
        <View role="alert" style={styles.error}>
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}

      <Button
        block
        disabled={formState.isSubmitting}
        label={formState.isSubmitting ? t('sequenz.speichertGerade') : t('sequenz.speichern')}
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  pairRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pairItem: {
    flex: 1,
  },
  tools: {
    flexDirection: 'row',
    gap: 6,
  },
  tool: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  toolOff: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  toolText: {
    fontSize: 15,
    color: colors.ink700,
  },
  addBlock: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  addBlockText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ocean700,
  },
  preview: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.oceanTint,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewValue: {
    fontSize: 15,
    color: colors.ink900,
  },
  error: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink900,
  },
});
