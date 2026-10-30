import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';

import { addDays, type IsoDate } from './dates';
import { diaryErrorKey } from './diaryErrors';
import { formatDay } from './format';
import { HabitLinkButton } from './HabitLinkButton';
import {
  useDeleteLog,
  useSaveLog,
  type HabitCategory,
  type HabitLog,
  type MyHabit,
} from './useHabits';

/** Das Habit, fuer das es den Messbildschirm gibt (docs/inhalte). */
export const BOLT_SLUG = 'bolt-wert';

type Props = {
  date: IsoDate;
  today: IsoDate;
  onChangeDate: (date: IsoDate) => void;
  habits: MyHabit[];
  logs: HabitLog[];
  categories: HabitCategory[];
  plusAccess: boolean;
  scoreOn: boolean;
};

/**
 * Die Tagesliste: jedes gewaehlte Habit mit seinem Eintrag fuer den
 * angezeigten Tag. Zurueckblaettern ist erlaubt (nachtragen), vorblaettern
 * bis heute.
 */
export function HabitDay({
  date,
  today,
  onChangeDate,
  habits,
  logs,
  categories,
  plusAccess,
  scoreOn,
}: Props) {
  const { t } = useTranslation();
  const label =
    date === today
      ? t('diary.day.today')
      : date === addDays(today, -1)
        ? t('diary.day.yesterday')
        : formatDay(date);

  return (
    <View style={styles.section}>
      <View style={styles.dayNav}>
        <PressableRing
          onPress={() => onChangeDate(addDays(date, -1))}
          accessibilityLabel={t('diary.day.prev')}
          style={styles.navButton}
        >
          <Text style={styles.navText}>‹</Text>
        </PressableRing>
        <Text style={styles.dayLabel}>{label}</Text>
        <PressableRing
          onPress={() => onChangeDate(addDays(date, 1))}
          disabled={date >= today}
          accessibilityLabel={t('diary.day.next')}
          style={[styles.navButton, date >= today && styles.navDisabled]}
        >
          <Text style={styles.navText}>›</Text>
        </PressableRing>
      </View>

      {habits.length === 0 ? (
        <StateMessage title={t('diary.day.empty.title')} body={t('diary.day.empty.hint')} />
      ) : (
        <View {...responsive('habits-grid')} style={styles.grid}>
          {habits.map((habit) => (
            <HabitEntryRow
              key={habit.id}
              habit={habit}
              date={date}
              log={logs.find((l) => l.user_habit_id === habit.id && l.log_date === date) ?? null}
              category={categories.find((c) => c.id === habit.habit_templates.category_id) ?? null}
              locked={!habit.habit_templates.is_preview && !plusAccess}
              scoreOn={scoreOn}
              past={date < today}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function HabitEntryRow({
  habit,
  date,
  log,
  category,
  locked,
  scoreOn,
  past = false,
}: {
  habit: MyHabit;
  date: IsoDate;
  log: HabitLog | null;
  category: HabitCategory | null;
  locked: boolean;
  scoreOn: boolean;
  /** Ein vergangener Tag: dort nur abhaken, keine Session starten. */
  past?: boolean;
}) {
  const { t } = useTranslation();
  const save = useSaveLog();
  const remove = useDeleteLog();
  const template = habit.habit_templates;
  const error = save.error ?? remove.error;
  // Abzug, wenn das Habit selbst abzieht (0028) oder - Altbestand - seine
  // ganze Kategorie; dieselbe Regel wie in score.ts.
  const negative = template.is_negative || (category?.is_negative ?? false);

  const markDone = () =>
    save.mutate({ userHabitId: habit.id, date, valueNumeric: 1 });
  const undo = () => remove.mutate({ userHabitId: habit.id, date });

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        {category ? <Text style={styles.category}>{category.title}</Text> : null}
        <Text style={styles.title}>{template.title}</Text>
        {template.description_md ? (
          <Text style={styles.description} numberOfLines={3}>
            {template.description_md}
          </Text>
        ) : null}

        {scoreOn && category && template.points > 0 ? (
          <Text style={negative ? styles.pointsNegative : styles.points}>
            {t(negative ? 'diary.entry.pointsNegative' : 'diary.entry.points', {
              points: template.points,
            })}
          </Text>
        ) : null}

        {locked ? <Text style={styles.meta}>{t('diary.entry.locked')}</Text> : null}

        {/* Eine Session traegt sich fuer HEUTE ein (exercise_id), nicht fuer
            den angezeigten Tag - an einem vergangenen Tag waere der Link
            deshalb irrefuehrend (30.10.2026). Messen nimmt das Datum mit. */}
        {!locked && !past && template.exercise_id && !log ? (
          <Link href={`/sessions/${template.exercise_id}`} style={styles.link}>
            {t('diary.entry.start')}
          </Link>
        ) : null}

        {!locked && !past && !template.exercise_id && !log ? (
          <HabitLinkButton
            url={template.link_url}
            sessionLabel={t('diary.entry.start')}
            linkLabel={t('diary.entry.openLink')}
          />
        ) : null}

        {!locked && template.slug === BOLT_SLUG && !log ? (
          <Link
            href={{ pathname: '/habit-tracker/bolt', params: { habit: habit.id, date } }}
            style={styles.link}
          >
            {t('diary.entry.measure')}
          </Link>
        ) : null}

        {error ? (
          <Text role="alert" style={styles.error}>
            {t(diaryErrorKey(error))}
          </Text>
        ) : null}
      </View>

      <EntryControl
        habit={habit}
        log={log}
        locked={locked}
        pending={save.isPending || remove.isPending}
        onDone={markDone}
        onValue={(valueNumeric, valueText) =>
          save.mutate({ userHabitId: habit.id, date, valueNumeric, valueText })
        }
        onUndo={undo}
      />
    </View>
  );
}

function EntryControl({
  habit,
  log,
  locked,
  pending,
  onDone,
  onValue,
  onUndo,
}: {
  habit: MyHabit;
  log: HabitLog | null;
  locked: boolean;
  pending: boolean;
  onDone: () => void;
  onValue: (valueNumeric: number | null, valueText: string | null) => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const template = habit.habit_templates;

  if (template.tracking_type === 'done') {
    const checked = log !== null;
    return (
      <PressableRing
        onPress={checked ? onUndo : onDone}
        // Entfernen geht immer - auch gesperrt (SAD §3.10). Neu abhaken nicht.
        disabled={pending || (!checked && locked)}
        role="checkbox"
        aria-checked={checked}
        accessibilityLabel={checked ? t('diary.entry.undo') : t('diary.entry.markDone')}
        style={[styles.tick, checked && styles.tickOn, !checked && locked && styles.tickLocked]}
      >
        <Text style={checked ? styles.tickMarkOn : styles.tickMark}>✓</Text>
      </PressableRing>
    );
  }

  if (log) {
    const shown =
      template.tracking_type === 'text'
        ? (log.value_text ?? '')
        : `${log.value_numeric ?? ''}${template.unit ? ` ${template.unit}` : ''}`;
    return (
      <View style={styles.valueBox}>
        <Text style={styles.value}>{shown}</Text>
        <PressableRing
          onPress={onUndo}
          disabled={pending}
          accessibilityLabel={t('diary.entry.undo')}
          style={styles.undo}
        >
          <Text style={styles.undoText}>×</Text>
        </PressableRing>
      </View>
    );
  }

  if (locked) return null;

  if (template.tracking_type === 'smiley_5') {
    return (
      <View style={styles.smileys}>
        {[1, 2, 3, 4, 5].map((n) => (
          <PressableRing key={n} onPress={() => onValue(n, null)} disabled={pending} style={styles.smiley}>
            <Text style={styles.smileyText}>{n}</Text>
          </PressableRing>
        ))}
      </View>
    );
  }

  return (
    <ValueInput
      kind={template.tracking_type === 'text' ? 'text' : 'number'}
      label={
        template.tracking_type === 'text'
          ? t('diary.entry.textLabel')
          : t('diary.entry.valueLabel', { unit: template.unit ?? '' })
      }
      // Im schmalen Zahlenfeld passt nur die Einheit; der ganze Satz bleibt
      // als aria-label fuer Screenreader.
      placeholder={template.tracking_type === 'text' ? undefined : (template.unit ?? undefined)}
      pending={pending}
      onSave={(raw) => {
        if (template.tracking_type === 'text') onValue(null, raw);
        else {
          const value = Number(raw.replace(',', '.'));
          if (Number.isFinite(value)) onValue(value, null);
        }
      }}
    />
  );
}

function ValueInput({
  kind,
  label,
  placeholder,
  pending,
  onSave,
}: {
  kind: 'number' | 'text';
  label: string;
  placeholder?: string;
  pending: boolean;
  onSave: (raw: string) => void;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');

  return (
    <View style={styles.inputRow}>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        inputMode={kind === 'number' ? 'decimal' : 'text'}
        aria-label={label}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.ink500}
        style={[styles.input, kind === 'text' && styles.inputWide]}
      />
      <PressableRing
        onPress={() => raw.trim() && onSave(raw.trim())}
        disabled={pending || raw.trim() === ''}
        style={styles.saveButton}
      >
        <Text style={styles.saveText}>{t('diary.entry.save')}</Text>
      </PressableRing>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    borderColor: colors.background,
    backgroundColor: colors.background,
  },
  navText: {
    fontSize: 20,
    color: colors.ink700,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  // Mobil eine Karte je Reihe, ab dem Breakpoint mehrere (habits-grid in
  // responsive.ts). flexWrap: ein Zahlenfeld rutscht in einer schmalen Karte
  // unter den Text, statt ihn zusammenzudruecken.
  row: {
    flexGrow: 0,
    flexBasis: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  category: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  meta: {
    fontSize: 13,
    color: colors.ink700,
  },
  points: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sage700,
  },
  pointsNegative: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  tick: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
  },
  tickLocked: {
    backgroundColor: colors.background,
    borderColor: colors.line,
  },
  tickMark: {
    fontSize: 18,
    color: colors.ink500,
  },
  tickMarkOn: {
    fontSize: 18,
    color: colors.surface,
  },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ocean700,
  },
  undo: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoText: {
    fontSize: 16,
    color: colors.ink700,
  },
  smileys: {
    flexDirection: 'row',
    gap: 4,
  },
  smiley: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smileyText: {
    fontSize: 13,
    color: colors.ink700,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // 100 statt 72: "Sekunden" als Platzhalter passt sonst nicht hinein.
  input: {
    width: 100,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    // 16 ist das Minimum, unter dem iOS Safari beim Antippen in die Seite
    // hineinzoomt - und danach verschoben stehen bleibt (30.10.2026).
    fontSize: 16,
    color: colors.ink900,
  },
  inputWide: {
    width: 140,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
