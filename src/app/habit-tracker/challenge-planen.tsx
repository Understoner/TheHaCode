import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { ChallengeCalendar, type DayMark } from '@/features/challenges/ChallengeCalendar';
import {
  challengeSchema,
  durationOf,
  endsOnOf,
  shiftPlan,
  toSaveInput,
  type ChallengeItemValue,
  type ChallengeValues,
} from '@/features/challenges/challengeForm';
import { describePlan } from '@/features/challenges/describePlan';
import { page } from '@/features/challenges/pageStyles';
import {
  expandPlan,
  parsePlan,
  parseTemplatePlan,
  templatePlanToPlan,
  type ChallengePlan,
} from '@/features/challenges/plan';
import {
  challengeErrorKey,
  useChallengeTemplates,
  useMyChallenges,
  useSaveChallenge,
  type Challenge,
  type ChallengeTemplate,
} from '@/features/challenges/useChallenges';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { addDays, today as heute, weekdayIndex, type IsoDate } from '@/features/habits/dates';
import { formatDay, formatShort } from '@/features/habits/format';
import { useHabitCatalog, type HabitCategory, type HabitTemplate } from '@/features/habits/useHabits';

const DURATIONS = [7, 14, 21, 30, 60, 90];
const BLOCK_LENGTHS = [2, 3, 4, 5, 7];
const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const;

/**
 * Eine Challenge planen (0036): neu (ohne Parameter), aus einer Vorlage
 * (?vorlage=...) oder den kuenftigen Plan einer bestehenden aendern (?id=...).
 * Vergangene Tage lassen sich nicht mehr antippen - die Datenbank haelt sie
 * ohnehin fest.
 */
export default function ChallengePlanScreen() {
  const { t } = useTranslation();
  const { id, vorlage } = useLocalSearchParams<{
    id?: string;
    vorlage?: string;
  }>();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={page.container}>
      <Link
        href={id ? { pathname: '/habit-tracker/challenge', params: { id } } : '/habit-tracker/challenges'}
        style={page.back}
      >
        {t('challenges.back')}
      </Link>
      <Text role="heading" style={page.title}>
        {t(id ? 'challenges.editor.editTitle' : 'challenges.editor.newTitle')}
      </Text>
      {loading ? (
        <SkeletonList />
      ) : session ? (
        <EditorLoader id={id ?? null} templateId={vorlage ?? null} />
      ) : (
        <StateMessage title={t('diary.login.title')} body={t('challenges.login')} />
      )}
    </ScrollView>
  );
}

function EditorLoader({ id, templateId }: { id: string | null; templateId: string | null }) {
  const { t } = useTranslation();
  const catalog = useHabitCatalog();
  const templates = useChallengeTemplates();
  const challenges = useMyChallenges();
  const plus = usePlusAccess();
  const consents = useConsents();

  return (
    <QueryBoundary query={plus}>
      {(plusAccess) => (
        <QueryBoundary query={consents}>
          {(consentList) => (
            <QueryBoundary query={catalog}>
              {({ categories, templates: habits }) => (
                <QueryBoundary query={templates}>
                  {(templateList) => (
                    <QueryBoundary query={challenges}>
                      {(list) => {
                        const consented = consentList.some((c) => c.definition.kind === 'health_data' && c.granted);
                        const existing = id ? (list.find((c) => c.id === id) ?? null) : null;
                        const template = templateId ? (templateList.find((x) => x.id === templateId) ?? null) : null;

                        if (id && !existing) {
                          return (
                            <StateMessage title={t('challenges.missing.title')} body={t('challenges.missing.text')} />
                          );
                        }
                        if (existing?.cancelled_at || (existing && existing.ends_on < heute())) {
                          return (
                            <StateMessage
                              title={t('challenges.editor.closedTitle')}
                              body={t('challenges.editor.closedText')}
                            />
                          );
                        }
                        const access =
                          plusAccess ||
                          (existing ? false : (template?.is_preview ?? false)) ||
                          (existing !== null &&
                            templateList.some((x) => x.id === existing.template_id && x.is_preview));
                        if (!consented) {
                          return <StateMessage title={t('challenges.title')} body={t('challenges.consentNeeded')} />;
                        }
                        if (!access) {
                          return <StateMessage title={t('challenges.title')} body={t('challenges.plusOnly')} />;
                        }
                        // Auswaehlbar: was die Person eintragen darf, ohne Abzugs-Habits -
                        // ein "nicht tun" laesst sich nicht planen.
                        const usable = habits.filter(
                          (h) => !h.is_negative && (plusAccess || h.is_preview) && h.deleted_at === null,
                        );
                        return (
                          <ChallengeEditor
                            key={existing?.id ?? template?.id ?? 'neu'}
                            existing={existing}
                            template={template}
                            habits={usable}
                            categories={categories}
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
      )}
    </QueryBoundary>
  );
}

function defaultsFor(existing: Challenge | null, template: ChallengeTemplate | null, today: IsoDate): ChallengeValues {
  if (existing) {
    return {
      title: existing.title,
      description: existing.description_md ?? '',
      startsOn: existing.starts_on,
      durationDays: durationOf(existing.starts_on, existing.ends_on),
      items: existing.challenge_items.flatMap((item) => {
        const templateId = item.user_habits?.template_id;
        if (!templateId) return [];
        return [
          {
            habitTemplateId: templateId,
            plan: parsePlan(item.plan),
            hasPast: existing.challenge_slots.some((s) => s.item_id === item.id && s.starts_on < today),
          },
        ];
      }),
    };
  }
  if (template) {
    return {
      title: template.title,
      description: template.description_md ?? '',
      startsOn: today,
      durationDays: template.duration_days,
      items: template.challenge_template_items.map((i) => ({
        habitTemplateId: i.habit_template_id,
        plan: templatePlanToPlan(parseTemplatePlan(i.plan), today),
        hasPast: false,
      })),
    };
  }
  return {
    title: '',
    description: '',
    startsOn: today,
    durationDays: 21,
    items: [],
  };
}

function ChallengeEditor({
  existing,
  template,
  habits,
  categories,
}: {
  existing: Challenge | null;
  template: ChallengeTemplate | null;
  habits: HabitTemplate[];
  categories: HabitCategory[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveChallenge();
  const today = heute();
  const started = existing !== null && existing.starts_on < today;

  const { control, handleSubmit, setValue, getValues, formState } = useForm<ChallengeValues>({
    resolver: zodResolver(challengeSchema),
    defaultValues: defaultsFor(existing, template, today),
    mode: 'onTouched',
  });
  const startsOn = useWatch({ control, name: 'startsOn' });
  const durationDays = useWatch({ control, name: 'durationDays' });
  const items = useWatch({ control, name: 'items' });
  const endsOn = endsOnOf(startsOn, durationDays || 1);

  const setItems = (next: ChallengeItemValue[]) => setValue('items', next, { shouldValidate: formState.isSubmitted });

  // Ein neuer Start verschiebt den ganzen Plan mit, damit "Tag 10" Tag 10 bleibt.
  const changeStart = (day: IsoDate) => {
    const delta = durationOf(getValues('startsOn'), day) - 1;
    const back = durationOf(day, getValues('startsOn')) - 1;
    const shift = day >= getValues('startsOn') ? delta : -back;
    setValue('startsOn', day);
    setItems(getValues('items').map((i) => ({ ...i, plan: shiftPlan(i.plan, shift) })));
  };

  const onSubmit = (values: ChallengeValues) => {
    save.mutate(
      toSaveInput(values, {
        id: existing?.id,
        templateId: existing?.template_id ?? template?.id ?? null,
      }),
      {
        onSuccess: (newId) =>
          router.replace({
            pathname: '/habit-tracker/challenge',
            params: { id: newId },
          }),
      },
    );
  };

  const titleOf = (habitTemplateId: string) =>
    habits.find((h) => h.id === habitTemplateId)?.title ?? t('challenges.editor.unknownHabit');
  const itemsError = formState.errors.items?.message ?? formState.errors.items?.root?.message;

  return (
    <View style={page.stack}>
      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <TextField
            label={t('challenges.editor.fieldTitle')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('challenges.editor.fieldTitlePlaceholder')}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field, fieldState }) => (
          <TextField
            label={t('challenges.editor.fieldDescription')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />

      <View style={page.card}>
        <Text style={page.label}>{t('challenges.editor.start')}</Text>
        {started ? (
          <Text style={page.meta}>{t('challenges.editor.startFixed')}</Text>
        ) : (
          <View style={page.row}>
            {/* Am Sonntag sind "Morgen" und "Naechsten Montag" derselbe Tag - dann nur einmal. */}
            {(
              [
                ['challenges.editor.today', today],
                ['challenges.editor.tomorrow', addDays(today, 1)],
                ['challenges.editor.nextMonday', nextMonday(today)],
              ] as const
            )
              .filter(([, day], i, all) => all.findIndex(([, d]) => d === day) === i)
              .map(([label, day]) => (
                <Chip key={day} label={t(label)} active={startsOn === day} onPress={() => changeStart(day)} />
              ))}
          </View>
        )}
        <Text style={page.label}>{t('challenges.editor.duration')}</Text>
        <Controller
          control={control}
          name="durationDays"
          render={({ field, fieldState }) => (
            <View style={page.stack}>
              <View style={page.row}>
                {DURATIONS.map((d) => (
                  <Chip
                    key={d}
                    label={t('challenges.days', { count: d })}
                    active={field.value === d}
                    // Ein laufende Challenge laesst sich verlaengern oder kuerzen,
                    // aber nicht vor heute enden lassen.
                    disabled={endsOnOf(startsOn, d) < today}
                    onPress={() => field.onChange(d)}
                  />
                ))}
              </View>
              <TextField
                label={t('challenges.editor.durationCustom')}
                value={String(field.value || '')}
                onChangeText={(v) => field.onChange(Number(v.replace(/\D/g, '')) || 0)}
                onBlur={field.onBlur}
                inputMode="numeric"
                error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              />
            </View>
          )}
        />
        <Text style={page.meta}>
          {t('challenges.editor.rangeSummary', {
            from: formatShort(startsOn),
            to: formatShort(endsOn),
          })}
        </Text>
      </View>

      <Text style={page.sectionTitle}>{t('challenges.editor.habits')}</Text>
      {items.length === 0 ? <Text style={page.text}>{t('challenges.editor.noHabitsYet')}</Text> : null}
      {items.map((item, index) => (
        <ItemPlanEditor
          key={item.habitTemplateId}
          title={titleOf(item.habitTemplateId)}
          item={item}
          startsOn={startsOn}
          endsOn={endsOn}
          today={today}
          onChange={(plan) => setItems(items.map((x, i) => (i === index ? { ...x, plan } : x)))}
          onRemove={() => setItems(items.filter((_, i) => i !== index))}
        />
      ))}
      {itemsError ? (
        <Text role="alert" style={page.error}>
          {t(itemsError)}
        </Text>
      ) : null}

      <HabitPicker
        habits={habits}
        categories={categories}
        chosen={new Set(items.map((i) => i.habitTemplateId))}
        onAdd={(habitTemplateId) => setItems([...items, { habitTemplateId, plan: {}, hasPast: false }])}
      />

      <PlanPreview control={control} startsOn={startsOn} endsOn={endsOn} today={today} />

      {save.error ? (
        <Text role="alert" style={page.error}>
          {t(challengeErrorKey(save.error))}
        </Text>
      ) : null}
      <Button
        label={t(existing ? 'challenges.editor.save' : 'challenges.editor.create')}
        disabled={save.isPending}
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
}

function nextMonday(today: IsoDate): IsoDate {
  return addDays(today, 7 - weekdayIndex(today));
}

function Chip({
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
      role="checkbox"
      aria-checked={active}
      disabled={disabled}
      onPress={onPress}
      style={[page.chip, active && page.chipActive, disabled && !active && { opacity: 0.5 }]}
    >
      <Text style={[page.chipText, active && page.chipTextActive]}>{label}</Text>
    </PressableRing>
  );
}

/** Der Plan eines Habits: jeden Tag, Wochentage, einzelne Tage und Bloecke. */
function ItemPlanEditor({
  title,
  item,
  startsOn,
  endsOn,
  today,
  onChange,
  onRemove,
}: {
  title: string;
  item: ChallengeItemValue;
  startsOn: IsoDate;
  endsOn: IsoDate;
  today: IsoDate;
  onChange: (plan: ChallengePlan) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'day' | 'block'>('day');
  const [blockLength, setBlockLength] = useState(3);
  const plan = item.plan;
  const slots = useMemo(() => expandPlan(plan, startsOn, endsOn), [plan, startsOn, endsOn]);

  const toggleWeekday = (d: number) => {
    const set = new Set(plan.weekdays ?? []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({ ...plan, weekdays: [...set].sort() });
  };

  const tapDay = (day: IsoDate) => {
    const blocks = plan.blocks ?? [];
    const hit = blocks.find((b) => b.start <= day && addDays(b.start, b.length - 1) >= day);
    if (hit) {
      onChange({ ...plan, blocks: blocks.filter((b) => b !== hit) });
      return;
    }
    if (mode === 'block') {
      onChange({
        ...plan,
        blocks: [...blocks, { start: day, length: blockLength }].sort((a, b) => (a.start < b.start ? -1 : 1)),
      });
      return;
    }
    const dates = new Set(plan.dates ?? []);
    if (dates.has(day)) dates.delete(day);
    else dates.add(day);
    onChange({ ...plan, dates: [...dates].sort() });
  };

  const markOf = (day: IsoDate): DayMark => {
    const due = slots.some((s) => s.dueOn === day);
    const covered = slots.some((s) => s.startsOn <= day && s.dueOn > day);
    return { count: 0, tone: due ? 'open' : covered ? 'block' : 'none' };
  };

  return (
    <View style={page.card}>
      <View style={[page.row, { justifyContent: 'space-between' }]}>
        <Text style={page.cardTitle}>{title}</Text>
        <PressableRing
          onPress={onRemove}
          style={page.secondary}
          accessibilityLabel={t('challenges.editor.removeHabit', { title })}
        >
          <Text style={page.secondaryText}>{t('challenges.editor.remove')}</Text>
        </PressableRing>
      </View>
      {item.hasPast ? <Text style={page.meta}>{t('challenges.editor.hasPast')}</Text> : null}

      <View style={page.row}>
        <Chip
          label={t('challenges.plan.daily')}
          active={!!plan.daily}
          onPress={() => onChange({ ...plan, daily: !plan.daily })}
        />
        {WEEKDAYS.map((key, i) => (
          <Chip
            key={key}
            label={t(`challenges.weekday.${key}`)}
            active={!!plan.daily || (plan.weekdays ?? []).includes(i + 1)}
            disabled={!!plan.daily}
            onPress={() => toggleWeekday(i + 1)}
          />
        ))}
      </View>

      <Text style={page.label}>{t('challenges.editor.calendarMode')}</Text>
      <View style={page.row}>
        <Chip label={t('challenges.editor.modeDay')} active={mode === 'day'} onPress={() => setMode('day')} />
        <Chip label={t('challenges.editor.modeBlock')} active={mode === 'block'} onPress={() => setMode('block')} />
        {mode === 'block'
          ? BLOCK_LENGTHS.map((n) => (
              <Chip
                key={n}
                label={t('challenges.days', { count: n })}
                active={blockLength === n}
                onPress={() => setBlockLength(n)}
              />
            ))
          : null}
      </View>
      <Text style={page.meta}>
        {t(mode === 'day' ? 'challenges.editor.modeDayHint' : 'challenges.editor.modeBlockHint')}
      </Text>

      <ChallengeCalendar
        startsOn={startsOn}
        endsOn={endsOn}
        today={today}
        markOf={markOf}
        onPressDay={tapDay}
        isDisabled={(day) => day < today}
        labelOf={(day, mark) =>
          t(mark.tone === 'none' ? 'challenges.editor.dayFree' : 'challenges.editor.dayPlanned', {
            day: formatDay(day),
          })
        }
      />
      <Text style={page.meta}>
        {describePlan(plan, t)} · {t('challenges.editor.slotCount', { count: slots.length })}
      </Text>
    </View>
  );
}

/** Habits hinzufuegen, nach Kategorie, mit Suche. */
function HabitPicker({
  habits,
  categories,
  chosen,
  onAdd,
}: {
  habits: HabitTemplate[];
  categories: HabitCategory[];
  chosen: Set<string>;
  onAdd: (habitTemplateId: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const available = habits.filter((h) => !chosen.has(h.id) && (q === '' || h.title.toLowerCase().includes(q)));

  if (!open) {
    return (
      <PressableRing onPress={() => setOpen(true)} style={page.secondary}>
        <Text style={page.secondaryText}>{t('challenges.editor.addHabit')}</Text>
      </PressableRing>
    );
  }

  return (
    <View style={page.card}>
      <TextField label={t('challenges.editor.search')} value={query} onChangeText={setQuery} onBlur={() => undefined} />
      {available.length === 0 ? <Text style={page.meta}>{t('challenges.editor.noMatch')}</Text> : null}
      {categories.map((category) => {
        const inCategory = available.filter((h) => h.category_id === category.id);
        if (inCategory.length === 0) return null;
        return (
          <View key={category.id} style={{ gap: 8 }}>
            <Text style={page.label}>{category.title}</Text>
            <View style={page.row}>
              {inCategory.map((h) => (
                <PressableRing key={h.id} onPress={() => onAdd(h.id)} style={page.chip}>
                  <Text style={page.chipText}>+ {h.title}</Text>
                </PressableRing>
              ))}
            </View>
          </View>
        );
      })}
      <PressableRing onPress={() => setOpen(false)} style={page.secondary}>
        <Text style={page.secondaryText}>{t('challenges.editor.closePicker')}</Text>
      </PressableRing>
    </View>
  );
}

/** Alle Habits zusammen: wie viele Termine an welchem Tag. */
function PlanPreview({
  control,
  startsOn,
  endsOn,
  today,
}: {
  control: Control<ChallengeValues>;
  startsOn: IsoDate;
  endsOn: IsoDate;
  today: IsoDate;
}) {
  const { t } = useTranslation();
  const items = useWatch({ control, name: 'items' });
  const all = useMemo(() => items.flatMap((i) => expandPlan(i.plan, startsOn, endsOn)), [items, startsOn, endsOn]);
  if (items.length === 0) return null;

  return (
    <View style={page.card}>
      <Text style={page.label}>{t('challenges.editor.preview')}</Text>
      <ChallengeCalendar
        startsOn={startsOn}
        endsOn={endsOn}
        today={today}
        markOf={(day) => {
          const due = all.filter((s) => s.dueOn === day).length;
          const covered = all.filter((s) => s.startsOn <= day && s.dueOn > day).length;
          return {
            count: due + covered,
            tone: due ? 'open' : covered ? 'block' : 'none',
          };
        }}
      />
      <Text style={page.meta}>{t('challenges.editor.slotCount', { count: all.length })}</Text>
    </View>
  );
}
