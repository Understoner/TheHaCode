import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { TextField } from '@/components/TextField';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { displayFont } from '@/design/responsive';
import {
  parseFormNumber,
  QUICK_START_IDS,
  QUICK_STARTS,
  quickStartSteps,
  stepCount,
  stepDuration,
} from '@/features/configurator/builderHelpers';
import { previewDurationMs, previewRhythm } from '@/features/configurator/preview';
import {
  EDITABLE_PHASE_KINDS,
  emptySequence,
  MAX_BLOCKS,
  MAX_PHASE_SECONDS,
  MAX_PHASES_PER_BLOCK,
  MAX_REST_SECONDS,
  MAX_ROUNDS,
  newStep,
  sequenceSchema,
  type SequenceFormValues,
  type SequenceValues,
} from '@/features/configurator/schema';
import { mmss, toForm } from '@/features/configurator/SequenceEditor';
import { useSaveSequence } from '@/features/configurator/useSequences';
import type { PlayableExercise } from '@/types/breathing';

// Der Konfigurator im Vorschlag "Mondlicht Mobile" (03.11.2026, nur
// Testsystem). Dasselbe Formular, dieselbe Pruefung (schema.ts) und dasselbe
// Speichern wie SequenceEditor - nur fuer die Hand gebaut:
//   * Schnellstart mit bekannten Mustern statt leerem Blatt
//   * Plus/Minus fuer Runden und Sekunden statt Tastatur
//   * der Rhythmus als farbiger Streifen, waehrend man baut
//   * Seltenes (Blockname, Pause, Musik) aufgeklappt erst bei Bedarf
//
// Im Livesystem bleibt SequenceEditor.tsx.

type FormControl = Control<SequenceFormValues, unknown, SequenceValues>;
type Phase = SequenceFormValues['steps'][number]['phases'][number];

export function SequenceBuilder({ sequence }: { sequence?: PlayableExercise }) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveSequence();
  const [formError, setFormError] = useState<string | null>(null);
  const [musicOpen, setMusicOpen] = useState(Boolean(sequence?.spotify_url || sequence?.apple_music_url));
  const [defaults] = useState<SequenceFormValues>(() => (sequence ? toForm(sequence) : emptySequence()));

  const { control, handleSubmit, formState } = useForm<SequenceFormValues, unknown, SequenceValues>({
    resolver: zodResolver(sequenceSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const steps = useFieldArray({ control, name: 'steps' });
  const live = useWatch({ control, defaultValue: defaults });

  const onSubmit = async (values: SequenceValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: sequence?.id ?? null, values });
      router.replace('/sequenzen');
    } catch {
      setFormError(t('errors:sequenz.speichern'));
    }
  };

  const fieldError = (message?: string) => (message ? t(message) : undefined);
  const rhythm = previewRhythm(live);

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

      {/* Schnellstart nur beim Neuanlegen: eine gebaute Sequenz soll niemand
          mit einem Tipp versehentlich ueberschreiben. */}
      {sequence ? null : (
        <View style={styles.quick}>
          <Text style={styles.kicker}>{t('sequenz.m.quickTitle')}</Text>
          <View style={styles.quickRow}>
            {QUICK_START_IDS.map((id) => (
              <PressableRing key={id} onPress={() => steps.replace(quickStartSteps(id))} style={styles.quickChip}>
                <Text style={styles.quickName}>{t(`sequenz.m.quick.${id}`)}</Text>
                <Text style={styles.quickPattern}>
                  {QUICK_STARTS[id].phases.map(([, s]) => s).join('-')}
                </Text>
              </PressableRing>
            ))}
          </View>
        </View>
      )}

      <View style={styles.preview} aria-live="polite">
        <View style={styles.previewHead}>
          <Text style={styles.kicker}>{t('sequenz.vorschau')}</Text>
          <Text style={styles.previewValue}>
            {mmss(previewDurationMs(live))}
            {rhythm ? ` · ${rhythm}` : ''}
          </Text>
        </View>
        <RhythmStrip phases={(live.steps?.[0]?.phases ?? []) as Phase[]} />
      </View>

      {steps.fields.map((field, stepIndex) => (
        <BlockCard
          key={field.id}
          control={control}
          stepIndex={stepIndex}
          count={steps.fields.length}
          onUp={() => steps.swap(stepIndex, stepIndex - 1)}
          onDown={() => steps.swap(stepIndex, stepIndex + 1)}
          onRemove={() => steps.remove(stepIndex)}
        />
      ))}

      {steps.fields.length < MAX_BLOCKS ? (
        <PressableRing onPress={() => steps.append(newStep())} style={styles.addBlock}>
          <Text style={styles.addBlockText}>{t('sequenz.m.addBlock')}</Text>
        </PressableRing>
      ) : null}

      <View style={styles.card}>
        <PressableRing
          onPress={() => setMusicOpen(!musicOpen)}
          role="button"
          aria-expanded={musicOpen}
          style={styles.foldHead}
        >
          <View style={styles.grow}>
            <Text style={styles.blockTitle}>{t('sequenz.musik')}</Text>
            <Text style={styles.hint}>{t('sequenz.m.musicShort')}</Text>
          </View>
          <Text aria-hidden style={styles.sign}>
            {musicOpen ? '–' : '+'}
          </Text>
        </PressableRing>
        {musicOpen ? (
          <>
            <Text style={styles.hint}>{t('sequenz.musikHinweis')}</Text>
            <Controller
              control={control}
              name="spotify_url"
              render={({ field, fieldState }) => (
                <TextField
                  label={t('playlist.spotify')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldError(fieldState.error?.message)}
                  placeholder={t('sequenz.spotifyPlatzhalter')}
                  inputMode="url"
                  autoCapitalize="none"
                />
              )}
            />
            <Controller
              control={control}
              name="apple_music_url"
              render={({ field, fieldState }) => (
                <TextField
                  label={t('playlist.apple_music')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldError(fieldState.error?.message)}
                  placeholder={t('sequenz.applePlatzhalter')}
                  inputMode="url"
                  autoCapitalize="none"
                />
              )}
            />
          </>
        ) : null}
      </View>

      {formError ? (
        <View role="alert" style={styles.error}>
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}
      {/* Nach einem Fehlversuch steht oben bei den Feldern, was fehlt; hier
          der Hinweis, damit niemand am Knopf ratlos bleibt. */}
      {formState.submitCount > 0 && !formState.isValid && !formError ? (
        <Text role="alert" style={styles.invalid}>
          {t('sequenz.m.checkFields')}
        </Text>
      ) : null}

      <View style={styles.saveBar}>
        <View>
          <Text style={styles.kicker}>{t('sequenz.m.total')}</Text>
          <Text {...displayFont} style={styles.saveTime}>
            {mmss(previewDurationMs(live))}
          </Text>
        </View>
        <PressableRing
          onPress={handleSubmit(onSubmit)}
          disabled={formState.isSubmitting}
          style={styles.saveButton}
        >
          <Text style={styles.saveText}>
            {formState.isSubmitting ? t('sequenz.speichertGerade') : t('sequenz.speichern')}
          </Text>
        </PressableRing>
      </View>
    </View>
  );
}

/** Die erste Runde des ersten Blocks als Streifen: Breite = Dauer, Farbe = Phase. */
function RhythmStrip({ phases }: { phases: Phase[] }) {
  const { t } = useTranslation();
  const valid = phases
    .map((p) => ({ kind: p.kind, seconds: parseFormNumber(p.duration_seconds ?? '') ?? 0 }))
    .filter((p) => p.seconds > 0);
  if (valid.length === 0) return null;
  return (
    <View style={styles.strip} aria-hidden>
      {valid.map((p, i) => (
        <View key={i} style={[styles.seg, { flexGrow: p.seconds }, segStyle(p.kind)]}>
          <Text numberOfLines={1} style={[styles.segText, p.kind === 'inhale' || p.kind === 'exhale' ? styles.segTextOn : styles.segTextHold]}>
            {p.seconds >= 2 ? `${t(`sequenz.m.short.${p.kind}`)} ${String(p.seconds).replace('.', ',')}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function segStyle(kind: Phase['kind']) {
  if (kind === 'inhale') return styles.segInhale;
  if (kind === 'exhale') return styles.segExhale;
  return styles.segHold;
}

function ToolButton({ label, disabled, onPress, d }: { label: string; disabled: boolean; onPress: () => void; d: string }) {
  const palette = useThemePalette();
  return (
    <PressableRing
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled}
      accessibilityLabel={label}
      style={[styles.tool, disabled && styles.toolOff]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
        <Path d={d} fill="none" stroke={palette.ink700} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </PressableRing>
  );
}

const UP = 'M6 15l6-6 6 6';
const DOWN = 'M6 9l6 6 6-6';
const CROSS = 'M6 6l12 12M18 6L6 18';

function Stepper({
  value,
  onChange,
  onBlur,
  label,
  unit,
  step,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  label: string;
  unit?: string;
  step: (v: string, dir: 1 | -1) => string;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.stepperWrap}>
      <View style={styles.stepper}>
        <PressableRing
          onPress={() => {
            onChange(step(value, -1));
            onBlur();
          }}
          accessibilityLabel={t('sequenz.m.less', { label })}
          style={styles.stepButton}
        >
          <Text style={styles.stepSign}>–</Text>
        </PressableRing>
        <Text style={styles.stepValue} accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
          {value}
          {unit ? <Text style={styles.stepUnit}>{` ${unit}`}</Text> : null}
        </Text>
        <PressableRing
          onPress={() => {
            onChange(step(value, 1));
            onBlur();
          }}
          accessibilityLabel={t('sequenz.m.more', { label })}
          style={styles.stepButton}
        >
          <Text style={styles.stepSign}>+</Text>
        </PressableRing>
      </View>
      {error ? (
        <Text role="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function BlockCard({
  control,
  stepIndex,
  count,
  onUp,
  onDown,
  onRemove,
}: {
  control: FormControl;
  stepIndex: number;
  count: number;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const phases = useFieldArray({ control, name: `steps.${stepIndex}.phases` });
  const [moreOpen, setMoreOpen] = useState(false);
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  return (
    <View style={styles.card}>
      <View style={styles.blockHead}>
        <Text style={[styles.blockTitle, styles.grow]}>{t('sequenz.block', { nummer: stepIndex + 1 })}</Text>
        {count > 1 ? (
          <View style={styles.tools}>
            <ToolButton label={t('sequenz.nachOben')} disabled={stepIndex === 0} onPress={onUp} d={UP} />
            <ToolButton label={t('sequenz.nachUnten')} disabled={stepIndex === count - 1} onPress={onDown} d={DOWN} />
            <ToolButton label={t('sequenz.blockEntfernen')} disabled={false} onPress={onRemove} d={CROSS} />
          </View>
        ) : null}
      </View>

      <View style={styles.roundsRow}>
        <Text style={styles.rowLabel}>{t('sequenz.runden')}</Text>
        <Controller
          control={control}
          name={`steps.${stepIndex}.repeat_count`}
          render={({ field, fieldState }) => (
            <Stepper
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              label={t('sequenz.runden')}
              step={(v, dir) => stepCount(v, dir, 1, MAX_ROUNDS)}
              error={fieldError(fieldState.error?.message)}
            />
          )}
        />
      </View>

      <Text style={styles.kicker}>{t('sequenz.phasen')}</Text>
      {phases.fields.map((field, phaseIndex) => (
        <View key={field.id} style={styles.phase}>
          <Controller
            control={control}
            name={`steps.${stepIndex}.phases.${phaseIndex}.kind`}
            render={({ field: kindField }) => (
              <View role="radiogroup" aria-label={t('sequenz.m.phaseKind')} style={styles.kindRow}>
                {EDITABLE_PHASE_KINDS.map((kind) => {
                  const active = kindField.value === kind;
                  return (
                    <PressableRing
                      key={kind}
                      onPress={() => kindField.onChange(kind)}
                      role="radio"
                      aria-checked={active}
                      accessibilityLabel={t(`phase.${kind}`)}
                      style={[styles.kindChip, active && [styles.kindChipActive, segStyle(kind)]]}
                    >
                      <Text
                        style={[
                          styles.kindText,
                          active && (kind === 'inhale' || kind === 'exhale' ? styles.segTextOn : styles.segTextHold),
                        ]}
                      >
                        {t(`sequenz.m.short.${kind}`)}
                      </Text>
                    </PressableRing>
                  );
                })}
              </View>
            )}
          />
          <View style={styles.phaseFoot}>
            <Controller
              control={control}
              name={`steps.${stepIndex}.phases.${phaseIndex}.duration_seconds`}
              render={({ field: durationField, fieldState }) => (
                <Stepper
                  value={durationField.value}
                  onChange={durationField.onChange}
                  onBlur={durationField.onBlur}
                  label={t('sequenz.dauer')}
                  unit={t('sequenz.m.seconds')}
                  step={(v, dir) => stepDuration(v, dir, 0.5, MAX_PHASE_SECONDS)}
                  error={fieldError(fieldState.error?.message)}
                />
              )}
            />
            <View style={styles.tools}>
              <ToolButton label={t('sequenz.nachOben')} disabled={phaseIndex === 0} onPress={() => phases.swap(phaseIndex, phaseIndex - 1)} d={UP} />
              <ToolButton
                label={t('sequenz.nachUnten')}
                disabled={phaseIndex === phases.fields.length - 1}
                onPress={() => phases.swap(phaseIndex, phaseIndex + 1)}
                d={DOWN}
              />
              {/* Die letzte Phase bleibt - ein Block ohne Phase liesse sich
                  nicht abspielen (Migration 0009). */}
              <ToolButton
                label={t('sequenz.phaseEntfernen')}
                disabled={phases.fields.length === 1}
                onPress={() => phases.remove(phaseIndex)}
                d={CROSS}
              />
            </View>
          </View>
        </View>
      ))}
      {phases.fields.length < MAX_PHASES_PER_BLOCK ? (
        <PressableRing
          onPress={() => phases.append({ kind: 'inhale', duration_seconds: '4' })}
          style={styles.addPhase}
        >
          <Text style={styles.addPhaseText}>{t('sequenz.phaseHinzufuegen')}</Text>
        </PressableRing>
      ) : null}

      <PressableRing
        onPress={() => setMoreOpen(!moreOpen)}
        role="button"
        aria-expanded={moreOpen}
        style={styles.foldHead}
      >
        <Text style={[styles.foldTitle, styles.grow]}>{t('sequenz.m.blockMore')}</Text>
        <Text aria-hidden style={styles.sign}>
          {moreOpen ? '–' : '+'}
        </Text>
      </PressableRing>
      {moreOpen ? (
        <View style={styles.more}>
          <Controller
            control={control}
            name={`steps.${stepIndex}.label`}
            render={({ field, fieldState }) => (
              <TextField
                label={t('sequenz.blockName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldError(fieldState.error?.message)}
                placeholder={t('sequenz.blockNamePlatzhalter')}
              />
            )}
          />
          <View style={styles.roundsRow}>
            <Text style={styles.rowLabel}>{t('sequenz.m.rest')}</Text>
            <Controller
              control={control}
              name={`steps.${stepIndex}.rest_seconds`}
              render={({ field, fieldState }) => (
                <Stepper
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  label={t('sequenz.m.rest')}
                  unit={t('sequenz.m.seconds')}
                  step={(v, dir) => stepDuration(v, dir, 0, MAX_REST_SECONDS)}
                  error={fieldError(fieldState.error?.message)}
                />
              )}
            />
          </View>
        </View>
      ) : null}
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
    gap: 12,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  quick: {
    gap: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  quickName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink900,
  },
  quickPattern: {
    fontSize: 12,
    color: colors.ink700,
  },
  preview: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink900,
  },
  strip: {
    flexDirection: 'row',
    height: 34,
    borderRadius: 12,
    overflow: 'hidden',
  },
  seg: {
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  segInhale: {
    backgroundColor: colors.ocean700,
  },
  segExhale: {
    backgroundColor: colors.sage700,
  },
  segHold: {
    backgroundColor: colors.lineStrong,
  },
  segText: {
    fontSize: 11,
    fontWeight: '800',
  },
  segTextOn: {
    color: colors.surface,
  },
  segTextHold: {
    color: colors.ink900,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink900,
  },
  tools: {
    flexDirection: 'row',
    gap: 6,
  },
  tool: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolOff: {
    borderColor: 'transparent',
    backgroundColor: colors.background,
  },
  roundsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink900,
  },
  stepperWrap: {
    gap: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  stepSign: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.ink900,
  },
  stepValue: {
    minWidth: 64,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink900,
  },
  stepUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
  },
  fieldError: {
    fontSize: 12,
    color: colors.danger,
  },
  phase: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 6,
  },
  kindChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  kindChipActive: {
    borderColor: 'transparent',
  },
  kindText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink700,
  },
  phaseFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addPhase: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  addPhaseText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ocean700,
  },
  foldHead: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  foldTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink700,
  },
  sign: {
    fontSize: 18,
    color: colors.ink700,
  },
  more: {
    gap: 12,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  addBlock: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  addBlockText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ocean700,
  },
  error: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink900,
  },
  invalid: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
  },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.surface,
  },
  saveTime: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.ink900,
  },
  saveButton: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.surface,
  },
});
