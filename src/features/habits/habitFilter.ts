// Filter und Gruppierung fuer die Habit-Auswahl - rein, ohne React und Netz.

import type { HabitCategory, HabitTemplate } from './useHabits';

/** Woher ein Habit kommt, oder ob es gemerkt ist. */
export type HabitSource = 'all' | 'suggested' | 'own' | 'favorites';

export type HabitFilter = {
  source: HabitSource;
  /** null = alle Kategorien */
  categoryId: string | null;
  /** Freitext, ohne Gross-/Kleinschreibung, in Titel und Beschreibung */
  query: string;
};

export const NO_FILTER: HabitFilter = { source: 'all', categoryId: null, query: '' };

export function isOwn(template: HabitTemplate): boolean {
  return template.owner_id !== null;
}

export function filterTemplates(
  templates: HabitTemplate[],
  filter: HabitFilter,
  favorites: ReadonlySet<string>,
): HabitTemplate[] {
  const needle = filter.query.trim().toLocaleLowerCase('de');

  return templates.filter((template) => {
    if (filter.source === 'suggested' && isOwn(template)) return false;
    if (filter.source === 'own' && !isOwn(template)) return false;
    if (filter.source === 'favorites' && !favorites.has(template.id)) return false;
    if (filter.categoryId && template.category_id !== filter.categoryId) return false;
    if (needle) {
      const text = `${template.title} ${template.description_md ?? ''}`.toLocaleLowerCase('de');
      if (!text.includes(needle)) return false;
    }
    return true;
  });
}

export type HabitGroup = { category: HabitCategory; templates: HabitTemplate[] };

/**
 * Nach Kategorie gruppiert, in der Reihenfolge der Kategorien. Innerhalb
 * einer Kategorie stehen Favoriten oben, danach die Reihenfolge der
 * Redaktion, eigene Habits am Schluss. Leere Kategorien fallen weg.
 */
export function groupByCategory(
  categories: HabitCategory[],
  templates: HabitTemplate[],
  favorites: ReadonlySet<string>,
): HabitGroup[] {
  return categories
    .map((category) => ({
      category,
      templates: templates
        .filter((template) => template.category_id === category.id)
        .sort(
          (a, b) =>
            Number(favorites.has(b.id)) - Number(favorites.has(a.id)) ||
            Number(isOwn(a)) - Number(isOwn(b)) ||
            a.sort_order - b.sort_order ||
            a.title.localeCompare(b.title, 'de'),
        ),
    }))
    .filter((group) => group.templates.length > 0);
}
