import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { CORE_AREA, enabledCategoryIds, isAreaEnabled, toggleArea } from '@/features/habits/habitAreas';
import { AreaGlyph } from '@/features/habits/HabitPicker';
import { useHabitAreas, useHabitCatalog, useHabitScoreEnabled, useMyHabits } from '@/features/habits/useHabits';

// Die Einstellungen des Tagebuchs im Vorschlag "Mondlicht Mobile"
// (02.11.2026, nur Testsystem): Zeilen mit Zeichen statt Textkarten, echte
// Schalter, die Bereiche mit demselben Zeichen wie in der Habit-Auswahl.
// Daten, Hooks und Regeln sind dieselben wie in app/habit-tracker/
// einstellungen.tsx; im Livesystem bleibt die bisherige Darstellung.

const CHEVRON = 'M9 6l6 6-6 6';
const LIST = 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01';
const PLUS = 'M12 5v14M5 12h14';
const STAR = 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z';

function Icon({ d, color }: { d: string; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Ein Schalter, der wie einer aussieht: Spur mit Knopf, an = Gold. */
function Switch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <PressableRing
      onPress={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={[styles.track, on && styles.trackOn, disabled && styles.trackLocked]}
    >
      <View style={[styles.knob, on && styles.knobOn]} />
    </PressableRing>
  );
}

function Row({ icon, title, hint, right }: { icon: ReactNode; title: string; hint?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {typeof hint === 'string' ? <Text style={styles.rowHint}>{hint}</Text> : (hint ?? null)}
      </View>
      {right}
    </View>
  );
}

export function HabitSettingsView() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const { scoreOn, setScoreOn } = useHabitScoreEnabled();
  const myHabits = useMyHabits();
  const plus = usePlusAccess();
  const catalog = useHabitCatalog();
  const areas = useHabitAreas();

  return (
    <View style={styles.stack}>
      <Text style={styles.kicker}>{t('diary.settings.m.habits')}</Text>
      <View style={styles.group}>
        <Link href="/habit-tracker/auswahl" style={styles.rowLink}>
          <Row
            icon={<Icon d={LIST} color={palette.ocean700} />}
            title={t('diary.settings.habitsAction')}
            hint={
              <QueryBoundary query={myHabits}>
                {(habits) => (
                  <QueryBoundary query={catalog}>
                    {({ categories }) => (
                      <QueryBoundary query={areas.query}>
                        {(enabled) => {
                          const shown = enabledCategoryIds(categories, enabled);
                          const count = habits.filter((h) => h.is_active && shown.has(h.habit_templates.category_id)).length;
                          return <Text style={styles.rowHint}>{t('diary.settings.m.habitCount', { count })}</Text>;
                        }}
                      </QueryBoundary>
                    )}
                  </QueryBoundary>
                )}
              </QueryBoundary>
            }
            right={<Icon d={CHEVRON} color={palette.ink700} />}
          />
        </Link>
        <View style={styles.divider} />
        <QueryBoundary query={plus}>
          {(plusAccess) =>
            plusAccess ? (
              <Link href="/habit-tracker/eigenes-habit" style={styles.rowLink}>
                <Row
                  icon={<Icon d={PLUS} color={palette.ocean700} />}
                  title={t('habits.own.create')}
                  hint={t('diary.settings.m.ownHint')}
                  right={<Icon d={CHEVRON} color={palette.ink700} />}
                />
              </Link>
            ) : (
              <Link href="/plus" style={styles.rowLink}>
                <Row
                  icon={<Icon d={PLUS} color={palette.ink700} />}
                  title={t('habits.own.create')}
                  hint={t('habits.own.plusOnly')}
                  right={<Text style={styles.plus}>{t('diary.picker.toPlus')}</Text>}
                />
              </Link>
            )
          }
        </QueryBoundary>
      </View>

      <Text style={styles.kicker}>{t('diary.settings.m.score')}</Text>
      <View style={styles.group}>
        <Row
          icon={<Icon d={STAR} color={palette.ocean700} />}
          title={t('diary.score.toggle')}
          hint={t('diary.settings.score')}
          right={<Switch on={scoreOn} label={t('diary.score.toggle')} onToggle={() => setScoreOn(!scoreOn)} />}
        />
      </View>

      <Text style={styles.kicker}>{t('diary.settings.areas.title')}</Text>
      <Text style={styles.text}>{t('diary.settings.areas.text')}</Text>
      <QueryBoundary query={catalog}>
        {({ categories }) => (
          <QueryBoundary query={areas.query}>
            {(enabled) => (
              <View style={styles.group}>
                {categories.map((category, i) => {
                  const core = category.slug === CORE_AREA;
                  const on = isAreaEnabled(category.slug, enabled);
                  return (
                    <View key={category.id}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <Row
                        icon={<AreaGlyph slug={category.slug} color={on ? palette.ocean700 : palette.ink700} size={20} />}
                        title={category.title}
                        hint={core ? t('diary.settings.areas.core') : null}
                        right={
                          <Switch
                            on={on}
                            disabled={core}
                            label={category.title}
                            onToggle={() => areas.save.mutate(toggleArea(categories, enabled, category.slug, !on))}
                          />
                        }
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </QueryBoundary>
        )}
      </QueryBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  kicker: {
    marginTop: spacing.sm,
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  text: {
    paddingHorizontal: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  group: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rowLink: {
    display: 'flex',
    flexDirection: 'column',
    textDecorationLine: 'none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  plus: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ocean700,
  },
  divider: {
    height: 1,
    marginLeft: 62,
    backgroundColor: colors.line,
  },
  track: {
    width: 52,
    height: 32,
    padding: 3,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.background,
  },
  trackOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
  },
  trackLocked: {
    borderStyle: 'dashed',
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.ink700,
  },
  knobOn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surface,
  },
});
