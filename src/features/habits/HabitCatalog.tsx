import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';

import { diaryErrorKey } from './diaryErrors';
import {
  filterTemplates,
  groupByCategory,
  isOwn,
  NO_FILTER,
  type HabitFilter,
  type HabitSource,
} from './habitFilter';
import {
  useChooseHabit,
  useToggleHabitFavorite,
  type HabitCategory,
  type HabitTemplate,
  type MyHabit,
} from './useHabits';

const SOURCES: HabitSource[] = ['all', 'suggested', 'own', 'favorites'];

/**
 * Die Habit-Auswahl: filtern nach Herkunft (vorgeschlagen, selbst erstellt,
 * Favoriten) und Kategorie, aufnehmen, herausnehmen, merken.
 *
 * Gesperrte Habits stehen mit da - sichtbar, aber nicht waehlbar. Das ist die
 * Vorschau: wer ohne Plus BOLT fuehrt, sieht, was es sonst noch gibt. Die
 * Sperre selbst sitzt in der Datenbank (can_use_habit_template, 0021/0024);
 * hier wird sie nur vorher angezeigt.
 */
export function HabitCatalog({
  categories,
  templates,
  myHabits,
  favorites,
  plusAccess,
}: {
  categories: HabitCategory[];
  templates: HabitTemplate[];
  myHabits: MyHabit[];
  favorites: ReadonlySet<string>;
  plusAccess: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<HabitFilter>(NO_FILTER);
  const choose = useChooseHabit();
  const toggleFavorite = useToggleHabitFavorite();
  const active = new Set(myHabits.filter((h) => h.is_active).map((h) => h.template_id));

  const groups = useMemo(
    () => groupByCategory(categories, filterTemplates(templates, filter, favorites), favorites),
    [categories, templates, filter, favorites],
  );
  const usedCategories = categories.filter((c) => templates.some((tpl) => tpl.category_id === c.id));

  const error = choose.error ?? toggleFavorite.error;

  return (
    <View style={styles.section}>
      <View style={styles.chips} role="radiogroup" aria-label={t('habits.filter.source')}>
        {SOURCES.map((source) => (
          <Chip
            key={source}
            label={t(`habits.filter.${source}`)}
            active={filter.source === source}
            onPress={() => setFilter({ ...filter, source })}
          />
        ))}
      </View>

      {usedCategories.length > 1 ? (
        <View style={styles.chips} role="radiogroup" aria-label={t('habits.filter.category')}>
          <Chip
            label={t('habits.filter.allCategories')}
            active={filter.categoryId === null}
            onPress={() => setFilter({ ...filter, categoryId: null })}
          />
          {usedCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.title}
              active={filter.categoryId === category.id}
              onPress={() => setFilter({ ...filter, categoryId: category.id })}
            />
          ))}
        </View>
      ) : null}

      <TextInput
        value={filter.query}
        onChangeText={(query) => setFilter({ ...filter, query })}
        placeholder={t('habits.filter.search')}
        aria-label={t('habits.filter.search')}
        placeholderTextColor={colors.ink500}
        style={styles.search}
      />

      {error ? (
        <Text role="alert" style={styles.error}>
          {t(diaryErrorKey(error))}
        </Text>
      ) : null}

      {groups.length === 0 ? (
        <StateMessage
          title={t(filter.source === 'own' ? 'habits.empty.ownTitle' : 'habits.empty.title')}
          body={t(filter.source === 'own' ? 'habits.empty.ownHint' : 'habits.empty.hint')}
        />
      ) : (
        groups.map(({ category, templates: inCategory }) => (
          <View key={category.id} style={styles.group}>
            <Text style={styles.category}>{category.title}</Text>
            {inCategory.map((template) => {
              const chosen = active.has(template.id);
              const own = isOwn(template);
              const locked = !template.is_preview && !plusAccess;
              const favorite = favorites.has(template.id);

              return (
                <View key={template.id} style={styles.row}>
                  <PressableRing
                    role="button"
                    aria-pressed={favorite}
                    aria-label={t(favorite ? 'habits.favorite.remove' : 'habits.favorite.add', {
                      title: template.title,
                    })}
                    onPress={() => toggleFavorite.mutate({ templateId: template.id, favorite: !favorite })}
                    style={[styles.star, favorite && styles.starOn]}
                  >
                    <Text style={[styles.starGlyph, favorite && styles.starGlyphOn]}>
                      {favorite ? '★' : '☆'}
                    </Text>
                  </PressableRing>

                  <View style={styles.rowText}>
                    <Text style={styles.title}>{template.title}</Text>
                    <Text
                      style={
                        own ? styles.badgeOwn : template.is_preview ? styles.badgePreview : styles.badgePlus
                      }
                    >
                      {own
                        ? t('habits.badge.own')
                        : template.is_preview
                          ? t('diary.picker.preview')
                          : t('diary.picker.plus')}
                    </Text>
                    {template.description_md ? (
                      <Text style={styles.description}>{template.description_md}</Text>
                    ) : null}
                    {own ? (
                      <Link
                        href={{ pathname: '/tagebuch/eigenes-habit', params: { id: template.id } }}
                        style={styles.editLink}
                      >
                        {t('habits.edit')}
                      </Link>
                    ) : null}
                  </View>

                  {locked && !chosen ? (
                    <Link href="/plus" style={styles.plusLink}>
                      {t('diary.picker.toPlus')}
                    </Link>
                  ) : (
                    <PressableRing
                      onPress={() =>
                        choose.mutate({
                          templateId: template.id,
                          chosen: !chosen,
                          sortOrder: template.sort_order,
                        })
                      }
                      disabled={choose.isPending}
                      style={[styles.action, chosen && styles.actionOn]}
                    >
                      <Text style={[styles.actionText, chosen && styles.actionTextOn]}>
                        {chosen ? t('diary.picker.remove') : t('diary.picker.add')}
                      </Text>
                    </PressableRing>
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableRing
      role="radio"
      aria-checked={active}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableRing>
  );
}

const badge = {
  alignSelf: 'flex-start',
  fontSize: 11,
  fontWeight: '600',
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: radius.full,
} as const;

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
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
  chipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  chipTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  search: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink900,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  group: {
    gap: spacing.sm,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  star: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  starOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  starGlyph: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.ink700,
  },
  starGlyphOn: {
    color: colors.ocean700,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  badgePreview: {
    ...badge,
    color: colors.sage700,
    backgroundColor: colors.sageTint,
  },
  badgePlus: {
    ...badge,
    color: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  badgeOwn: {
    ...badge,
    color: colors.ink700,
    backgroundColor: colors.background,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
  },
  actionOn: {
    borderColor: colors.line,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  actionTextOn: {
    color: colors.ink700,
  },
  plusLink: {
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
