import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { FilterGroup, FilterOption, filterPageStyles } from '@/components/FilterControls';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import {
  habitFilterFromParams,
  habitFilterToParams,
  NO_FILTER,
  type HabitFilter,
  type HabitSource,
} from '@/features/habits/habitFilter';
import { enabledCategoryIds } from '@/features/habits/habitAreas';
import { useHabitAreas, useHabitCatalog } from '@/features/habits/useHabits';

const SOURCES: HabitSource[] = ['all', 'suggested', 'own', 'favorites'];

/**
 * Die Filterseite der Habit-Auswahl (30.10.2026): Herkunft, Kategorie und
 * Suche, die bis dahin ueber der Liste standen. Anders als bei Kursen und
 * Sessions mit "Anwenden": drei Angaben auf einmal, und ein Sprung zurueck
 * nach jeder einzelnen waere laestig.
 */
export default function HabitFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ quelle?: string; kategorie?: string; suche?: string }>();
  const [draft, setDraft] = useState<HabitFilter>(() => habitFilterFromParams(params));
  const catalog = useHabitCatalog();
  const areas = useHabitAreas();

  const apply = (filter: HabitFilter) =>
    router.replace({ pathname: '/habit-tracker/auswahl', params: habitFilterToParams(filter) });

  return (
    <ScrollView contentContainerStyle={filterPageStyles.container}>
      <Link
        href={{
          pathname: '/habit-tracker/auswahl',
          params: habitFilterToParams(habitFilterFromParams(params)),
        }}
        style={filterPageStyles.back}
      >
        {t('habits.filter.back')}
      </Link>
      <Text role="heading" style={filterPageStyles.title}>
        {t('habits.filter.title')}
      </Text>

      <View style={styles.searchGroup}>
        <Text style={styles.label}>{t('habits.filter.searchTitle')}</Text>
        <TextInput
          value={draft.query}
          onChangeText={(query) => setDraft({ ...draft, query })}
          onSubmitEditing={() => apply(draft)}
          placeholder={t('habits.filter.search')}
          aria-label={t('habits.filter.search')}
          placeholderTextColor={colors.ink500}
          returnKeyType="search"
          style={styles.search}
        />
      </View>

      <FilterGroup title={t('habits.filter.source')}>
        {SOURCES.map((source) => (
          <FilterOption
            key={source}
            label={t(`habits.filter.${source}`)}
            selected={draft.source === source}
            onPress={() => setDraft({ ...draft, source })}
          />
        ))}
      </FilterGroup>

      <QueryBoundary query={catalog}>
        {({ categories, templates }) => (
          <QueryBoundary query={areas.query}>
            {(enabledAreas) => {
              // Nur eingeschaltete Bereiche, in denen es ueberhaupt Habits gibt.
              const shown = enabledCategoryIds(categories, enabledAreas);
              const used = categories.filter(
                (c) => shown.has(c.id) && templates.some((tpl) => tpl.category_id === c.id),
              );
              if (used.length < 2) return null;
              return (
                <FilterGroup title={t('habits.filter.category')}>
                  <FilterOption
                    label={t('habits.filter.allCategories')}
                    selected={draft.categoryId === null}
                    onPress={() => setDraft({ ...draft, categoryId: null })}
                  />
                  {used.map((category) => (
                    <FilterOption
                      key={category.id}
                      label={category.title}
                      selected={draft.categoryId === category.id}
                      onPress={() => setDraft({ ...draft, categoryId: category.id })}
                    />
                  ))}
                </FilterGroup>
              );
            }}
          </QueryBoundary>
        )}
      </QueryBoundary>

      <View style={styles.actions}>
        <Button label={t('habits.filter.apply')} onPress={() => apply(draft)} />
        <PressableRing onPress={() => apply(NO_FILTER)} style={styles.reset}>
          <Text style={styles.resetText}>{t('filter.reset')}</Text>
        </PressableRing>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // 16: darunter zoomt iOS Safari beim Antippen hinein (30.10.2026).
  search: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink900,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  actions: {
    gap: spacing.sm,
  },
  reset: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
