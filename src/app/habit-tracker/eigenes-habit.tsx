import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { ownHabitErrorKey } from '@/features/habits/diaryErrors';
import { enabledCategoryIds } from '@/features/habits/habitAreas';
import { ownHabitSchema, toOwnHabitInput, type OwnHabitValues } from '@/features/habits/ownHabitForm';
import {
  useDeleteOwnHabit,
  useHabitAreas,
  useHabitCatalog,
  useSaveOwnHabit,
  type HabitCategory,
  type HabitTemplate,
} from '@/features/habits/useHabits';

/**
 * Ein eigenes Habit anlegen (ohne ?id) oder bearbeiten (?id=...).
 *
 * Anlegen und Bearbeiten sind Plus, Loeschen nicht (Migration 0024). Punkte
 * waehlt die Person, 0 bis 10 (0026), und ob das Habit sie bringt oder
 * abzieht (0028).
 */
export default function OwnHabitScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Angelegt wird aus den Einstellungen, bearbeitet aus der Auswahl
          (30.10.2026) - der Weg zurueck fuehrt dorthin, woher man kam. */}
      <Link href={id ? '/habit-tracker/auswahl' : '/habit-tracker/einstellungen'} style={styles.back}>
        {id ? t('habits.own.back') : t('habits.back')}
      </Link>
      <Text style={styles.title}>{t(id ? 'habits.own.editTitle' : 'habits.own.createTitle')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <OwnHabitLoader id={id ?? null} />
      ) : (
        <StateMessage title={t('diary.login.title')} body={t('diary.login.text')} />
      )}
    </ScrollView>
  );
}

function OwnHabitLoader({ id }: { id: string | null }) {
  const { t } = useTranslation();
  const catalog = useHabitCatalog();
  const areas = useHabitAreas();
  const plus = usePlusAccess();
  const consents = useConsents();

  return (
    <QueryBoundary query={plus}>
      {(plusAccess) => (
        <QueryBoundary query={consents}>
          {(consentList) => (
            <QueryBoundary query={catalog}>
              {({ categories, templates }) => (
                <QueryBoundary query={areas.query}>
                  {(enabledAreas) => {
                    // Ein eigenes Habit ist selbst eine Gesundheitsangabe (0025):
                    // anlegen und aendern nur mit Einwilligung, loeschen immer.
                    const consented = consentList.some(
                      (c) => c.definition.kind === 'health_data' && c.granted,
                    );
                    const existing = id
                      ? templates.find((tpl) => tpl.id === id && tpl.owner_id !== null)
                      : null;

                    if (id && !existing) {
                      return (
                        <StateMessage
                          title={t('habits.own.missingTitle')}
                          body={t('habits.own.missingHint')}
                        />
                      );
                    }
                    if (!existing && !plusAccess) {
                      return <StateMessage title={t('habits.own.title')} body={t('habits.own.plusOnly')} />;
                    }
                    if (!existing && !consented) {
                      return (
                        <StateMessage title={t('habits.own.title')} body={t('habits.own.consentNeeded')} />
                      );
                    }
                    // Neue eigene Habits nur in eingeschalteten Bereichen (0032);
                    // ein bestehendes behaelt seinen Bereich, auch wenn er aus ist.
                    const shown = enabledCategoryIds(categories, enabledAreas);
                    return (
                      <OwnHabitForm
                        categories={categories.filter(
                          (c) => !c.is_negative && (shown.has(c.id) || c.id === existing?.category_id),
                        )}
                        existing={existing ?? null}
                        canEdit={plusAccess && consented}
                      />
                    );
                  }}
                </QueryBoundary>
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

function OwnHabitForm({
  categories,
  existing,
  canEdit,
}: {
  categories: HabitCategory[];
  existing: HabitTemplate | null;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveOwnHabit();
  const remove = useDeleteOwnHabit();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { control, handleSubmit } = useForm<OwnHabitValues>({
    resolver: zodResolver(ownHabitSchema),
    defaultValues: {
      title: existing?.title ?? '',
      description: existing?.description_md ?? '',
      categoryId: existing?.category_id ?? (categories.length === 1 ? categories[0].id : ''),
      trackingType: existing?.tracking_type === 'number' ? 'number' : 'done',
      unit: existing?.unit ?? '',
      minValue: existing?.min_value?.toString() ?? '',
      maxValue: existing?.max_value?.toString() ?? '',
      points: existing?.points ?? 5,
      isNegative: existing?.is_negative ?? false,
      higherIsBetter: existing?.higher_is_better ?? true,
      pointsFrom: existing?.points_from?.toString() ?? '',
      penaltyFrom: existing?.penalty_from?.toString() ?? '',
      penaltyPoints: existing?.penalty_points ?? 5,
      link: existing?.link_url ?? '',
    },
    mode: 'onTouched',
  });
  const trackingType = useWatch({ control, name: 'trackingType' });
  const isNegative = useWatch({ control, name: 'isNegative' });
  const higherIsBetter = useWatch({ control, name: 'higherIsBetter' });
  const penaltyFrom = useWatch({ control, name: 'penaltyFrom' });

  const onSubmit = (values: OwnHabitValues) => {
    save.mutate(
      { id: existing?.id, input: toOwnHabitInput(values) },
      { onSuccess: () => router.replace('/habit-tracker/auswahl') },
    );
  };

  return (
    <View style={styles.stack}>
      {!canEdit ? <Text style={styles.notice}>{t('habits.own.readOnly')}</Text> : null}

      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <TextField
            label={t('habits.own.fieldTitle')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('habits.own.fieldTitlePlaceholder')}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />

      <Controller
        control={control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <View style={styles.field}>
            <Text style={styles.label}>{t('habits.own.fieldCategory')}</Text>
            <View style={styles.chips} role="radiogroup" aria-label={t('habits.own.fieldCategory')}>
              {categories.map((category) => (
                <Choice
                  key={category.id}
                  label={category.title}
                  active={field.value === category.id}
                  onPress={() => field.onChange(category.id)}
                />
              ))}
            </View>
            {fieldState.error ? (
              <Text role="alert" style={styles.error}>
                {t(fieldState.error.message ?? '')}
              </Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="trackingType"
        render={({ field }) => (
          <View style={styles.field}>
            <Text style={styles.label}>{t('habits.own.fieldType')}</Text>
            <View style={styles.chips} role="radiogroup" aria-label={t('habits.own.fieldType')}>
              {(['done', 'number'] as const).map((type) => (
                <Choice
                  key={type}
                  label={t(`habits.own.type.${type}`)}
                  active={field.value === type}
                  // Nach dem Anlegen fest: vorhandene Eintraege passen sonst
                  // nicht mehr zur Art (die Datenbank lehnt es ebenfalls ab).
                  disabled={existing !== null}
                  onPress={() => field.onChange(type)}
                />
              ))}
            </View>
            {existing ? <Text style={styles.hint}>{t('habits.own.typeFixed')}</Text> : null}
          </View>
        )}
      />

      {trackingType === 'number' ? (
        <View style={styles.stack}>
          <Controller
            control={control}
            name="unit"
            render={({ field, fieldState }) => (
              <TextField
                label={t('habits.own.fieldUnit')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder={t('habits.own.fieldUnitPlaceholder')}
                error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              />
            )}
          />
          <View style={styles.range}>
            <View style={styles.rangeField}>
              <Controller
                control={control}
                name="minValue"
                render={({ field, fieldState }) => (
                  <TextField
                    label={t('habits.own.fieldMin')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    inputMode="decimal"
                    error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                  />
                )}
              />
            </View>
            <View style={styles.rangeField}>
              <Controller
                control={control}
                name="maxValue"
                render={({ field, fieldState }) => (
                  <TextField
                    label={t('habits.own.fieldMax')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    inputMode="decimal"
                    error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                  />
                )}
              />
            </View>
          </View>
        </View>
      ) : null}

      <Controller
        control={control}
        name="description"
        render={({ field, fieldState }) => (
          <TextField
            label={t('habits.own.fieldDescription')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />

      {/* Verknuepfung mit einer Session (0030): der Redaktion oder einer
          eigenen aus dem Konfigurator. Die Adresse kommt aus der Adresszeile;
          eine Adresse dieser App wird beim Speichern zum Pfad. */}
      <Controller
        control={control}
        name="link"
        render={({ field, fieldState }) => (
          <View style={styles.field}>
            <TextField
              label={t('habits.own.fieldLink')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('habits.own.fieldLinkPlaceholder')}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            />
            <Text style={styles.hint}>{t('habits.own.linkHint')}</Text>
          </View>
        )}
      />

      <Controller
        control={control}
        name="isNegative"
        render={({ field }) => (
          <View style={styles.field}>
            <Text style={styles.label}>{t('habits.own.fieldEffect')}</Text>
            <View style={styles.chips} role="radiogroup" aria-label={t('habits.own.fieldEffect')}>
              {([false, true] as const).map((negative) => (
                <Choice
                  key={String(negative)}
                  label={t(negative ? 'habits.own.effect.negative' : 'habits.own.effect.positive')}
                  active={field.value === negative}
                  onPress={() => field.onChange(negative)}
                />
              ))}
            </View>
            {field.value ? <Text style={styles.hint}>{t('habits.own.effectHint')}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="points"
        render={({ field }) => (
          <View style={styles.field}>
            <Text style={styles.label}>{t('habits.own.fieldPoints')}</Text>
            <View style={styles.chips} role="radiogroup" aria-label={t('habits.own.fieldPoints')}>
              {Array.from({ length: 11 }, (_, points) => (
                <Choice
                  key={points}
                  label={String(points)}
                  active={field.value === points}
                  onPress={() => field.onChange(points)}
                />
              ))}
            </View>
            <Text style={styles.hint}>{t('habits.own.pointsHint')}</Text>
          </View>
        )}
      />

      {/* Punkte nach Wert (0035): nur fuer Messwerte, die Punkte bringen.
          Beide Grenzen sind freiwillig. */}
      {trackingType === 'number' && !isNegative ? (
        <View style={styles.valueBox}>
          <Text style={styles.label}>{t('habits.own.valueTitle')}</Text>
          <Text style={styles.hint}>{t('habits.own.valueHint')}</Text>

          <Controller
            control={control}
            name="higherIsBetter"
            render={({ field }) => (
              <View style={styles.chips} role="radiogroup" aria-label={t('habits.own.valueDirection')}>
                {([true, false] as const).map((higher) => (
                  <Choice
                    key={String(higher)}
                    label={t(higher ? 'habits.own.valueHigher' : 'habits.own.valueLower')}
                    active={field.value === higher}
                    onPress={() => field.onChange(higher)}
                  />
                ))}
              </View>
            )}
          />

          <View style={styles.range}>
            <View style={styles.rangeField}>
              <Controller
                control={control}
                name="pointsFrom"
                render={({ field, fieldState }) => (
                  <TextField
                    label={t(higherIsBetter ? 'habits.own.fieldPointsFrom' : 'habits.own.fieldPointsUpTo')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    inputMode="decimal"
                    error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                  />
                )}
              />
            </View>
            <View style={styles.rangeField}>
              <Controller
                control={control}
                name="penaltyFrom"
                render={({ field, fieldState }) => (
                  <TextField
                    label={t(higherIsBetter ? 'habits.own.fieldPenaltyBelow' : 'habits.own.fieldPenaltyAbove')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    inputMode="decimal"
                    error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                  />
                )}
              />
            </View>
          </View>

          {penaltyFrom.trim() !== '' ? (
            <Controller
              control={control}
              name="penaltyPoints"
              render={({ field }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>{t('habits.own.fieldPenaltyPoints')}</Text>
                  <View style={styles.chips} role="radiogroup" aria-label={t('habits.own.fieldPenaltyPoints')}>
                    {Array.from({ length: 11 }, (_, points) => (
                      <Choice
                        key={points}
                        label={String(points)}
                        active={field.value === points}
                        onPress={() => field.onChange(points)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>
      ) : null}

      {save.error ? (
        <Text role="alert" style={styles.error}>
          {t(ownHabitErrorKey(save.error))}
        </Text>
      ) : null}

      {canEdit ? (
        <Button
          label={t(existing ? 'habits.own.save' : 'habits.own.create')}
          disabled={save.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      ) : null}

      {existing ? (
        <View style={styles.deleteBox}>
          {remove.error ? (
            <Text role="alert" style={styles.error}>
              {t(ownHabitErrorKey(remove.error))}
            </Text>
          ) : null}
          {confirmDelete ? (
            <View style={styles.stack}>
              <Text style={styles.text}>{t('habits.own.deleteConfirm')}</Text>
              <View style={styles.chips}>
                <PressableRing
                  onPress={() =>
                    remove.mutate(existing.id, { onSuccess: () => router.replace('/habit-tracker/auswahl') })
                  }
                  disabled={remove.isPending}
                  style={styles.danger}
                >
                  <Text style={styles.dangerText}>{t('habits.own.deleteYes')}</Text>
                </PressableRing>
                <PressableRing onPress={() => setConfirmDelete(false)} style={styles.secondary}>
                  <Text style={styles.secondaryText}>{t('habits.own.deleteNo')}</Text>
                </PressableRing>
              </View>
            </View>
          ) : (
            <PressableRing onPress={() => setConfirmDelete(true)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t('habits.own.delete')}</Text>
            </PressableRing>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Choice({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableRing
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, disabled && !active && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableRing>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  stack: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.sm,
  },
  // Wie die Beschriftung in TextField, damit alle Felder gleich aussehen.
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  chipDisabled: {
    backgroundColor: colors.background,
  },
  chipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  chipTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  valueBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  range: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rangeField: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  notice: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSubtle,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  deleteBox: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
  secondary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    fontSize: 14,
    color: colors.ink700,
  },
  danger: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  dangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
});
