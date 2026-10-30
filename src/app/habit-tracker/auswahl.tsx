import { Link, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActiveFilter } from '@/components/FilterControls';
import { FilterGlyph, HEADER_ICON_SIZE, HeaderIconLink } from '@/components/HeaderIcon';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { colors, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { HabitCatalog } from '@/features/habits/HabitCatalog';
import {
  habitFilterFromParams,
  habitFilterToParams,
  isFiltered,
  type HabitFilter,
} from '@/features/habits/habitFilter';
import { enabledCategoryIds } from '@/features/habits/habitAreas';
import {
  useHabitAreas,
  useHabitCatalog,
  useHabitFavorites,
  useMyHabits,
  type HabitCategory,
} from '@/features/habits/useHabits';

/**
 * Eigene Seite fuer die Habit-Auswahl (seit 25.10.2026). Im Tagebuch selbst
 * wurde die Liste mit jedem neuen Habit laenger und schob den Tag nach unten;
 * hier ist Platz fuer Filter, Favoriten und eigene Habits.
 */
export default function HabitsScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const filter =
    habitFilterFromParams(useLocalSearchParams<{ quelle?: string; kategorie?: string; suche?: string }>());

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker/einstellungen" style={styles.back}>
        {t('habits.back')}
      </Link>
      {/* Der Trichter neben der Ueberschrift oeffnet die Filterseite
          (30.10.2026); die Chips und die Suche standen bis dahin hier. */}
      <View style={styles.titleRow}>
        <Text role="heading" style={styles.title}>
          {t('diary.picker.title')}
        </Text>
        <HeaderIconLink
          href={{ pathname: '/habit-tracker/auswahl-filter', params: habitFilterToParams(filter) }}
          label={t('habits.filter.open')}
          active={isFiltered(filter)}
        >
          <FilterGlyph active={isFiltered(filter)} />
        </HeaderIconLink>
      </View>
      <Text style={styles.intro}>{t('habits.intro')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <HabitsForUser filter={filter} />
      ) : (
        <StateMessage title={t('diary.login.title')} body={t('diary.login.text')} />
      )}
    </ScrollView>
  );
}

function HabitsForUser({ filter }: { filter: HabitFilter }) {
  const { t } = useTranslation();
  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const favorites = useHabitFavorites();
  const plus = usePlusAccess();
  const areas = useHabitAreas();

  return (
    <QueryBoundary query={plus}>
      {(plusAccess) => (
        <View style={styles.stack}>
          <QueryBoundary query={catalog}>
            {({ categories, templates }) => (
              <QueryBoundary query={myHabits}>
                {(habits) => (
                  <QueryBoundary query={favorites}>
                    {(favoriteIds) => (
                      <QueryBoundary query={areas.query}>
                        {(enabledAreas) => {
                          // Nur eingeschaltete Bereiche (Einstellungen, 0032).
                          const shown = enabledCategoryIds(categories, enabledAreas);
                          return (
                            <View style={styles.stack}>
                              {isFiltered(filter) ? (
                                <ActiveFilter
                                  summary={filterSummary(filter, categories, t)}
                                  resetHref="/habit-tracker/auswahl"
                                />
                              ) : null}
                              <HabitCatalog
                                categories={categories.filter((c) => shown.has(c.id))}
                                templates={templates.filter((tpl) => shown.has(tpl.category_id))}
                                myHabits={habits}
                                favorites={favoriteIds}
                                plusAccess={plusAccess}
                                filter={filter}
                              />
                            </View>
                          );
                        }}
                      </QueryBoundary>
                    )}
                  </QueryBoundary>
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        </View>
      )}
    </QueryBoundary>
  );
}

/** "Selbst erstellt · Atmung · „kalt“" - was gerade gefiltert ist. */
function filterSummary(filter: HabitFilter, categories: HabitCategory[], t: TFunction): string {
  return [
    filter.source !== 'all' ? t(`habits.filter.${filter.source}`) : null,
    filter.categoryId ? (categories.find((c) => c.id === filter.categoryId)?.title ?? null) : null,
    filter.query.trim() ? `„${filter.query.trim()}“` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    // Volle Breite wie die Sessions (26.10.2026) - die Karten darunter
    // verteilen sich ueber habits-grid auf mehrere Spalten.
    width: '100%',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: HEADER_ICON_SIZE,
    fontWeight: '600',
    color: colors.ink900,
  },
  intro: {
    // Fliesstext bleibt lesbar schmal, auch wenn die Seite breit ist.
    maxWidth: 720,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
  },
  stack: {
    gap: spacing.lg,
  },
});
