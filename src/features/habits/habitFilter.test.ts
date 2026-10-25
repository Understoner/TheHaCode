import { describe, expect, it } from 'vitest';

import { filterTemplates, groupByCategory, NO_FILTER } from './habitFilter';
import type { HabitCategory, HabitTemplate } from './useHabits';

const D = '2026-10-25';

function category(id: string, sort: number): HabitCategory {
  return {
    id,
    slug: id,
    title: id,
    description: null,
    icon: null,
    is_negative: false,
    max_per_day: 20,
    max_per_week: 100,
    max_per_month: 400,
    sort_order: sort,
    is_published: true,
    created_at: D,
    updated_at: D,
  };
}

function template(id: string, overrides: Partial<HabitTemplate> = {}): HabitTemplate {
  return {
    id,
    slug: id,
    category_id: 'atmung',
    title: id,
    description_md: null,
    tracking_type: 'done',
    unit: null,
    min_value: null,
    max_value: null,
    step_value: null,
    default_target: null,
    higher_is_better: true,
    points: 10,
    is_preview: false,
    exercise_id: null,
    icon: null,
    sort_order: 0,
    is_published: true,
    created_at: D,
    updated_at: D,
    owner_id: null,
    deleted_at: null,
    client_id: null,
    ...overrides,
  };
}

const bolt = template('BOLT', { description_md: 'Atem anhalten', sort_order: 1 });
const schlaf = template('Einschlafen', { sort_order: 2 });
const kalt = template('Kalt duschen', { category_id: 'kaelte', owner_id: 'ich', points: 0 });
const alle = [bolt, schlaf, kalt];

describe('filterTemplates', () => {
  it('zeigt ohne Filter alles', () => {
    expect(filterTemplates(alle, NO_FILTER, new Set())).toHaveLength(3);
  });

  it('trennt vorgeschlagene von selbst erstellten', () => {
    expect(filterTemplates(alle, { ...NO_FILTER, source: 'suggested' }, new Set())).toEqual([bolt, schlaf]);
    expect(filterTemplates(alle, { ...NO_FILTER, source: 'own' }, new Set())).toEqual([kalt]);
  });

  it('zeigt nur Favoriten', () => {
    expect(filterTemplates(alle, { ...NO_FILTER, source: 'favorites' }, new Set(['Einschlafen']))).toEqual([
      schlaf,
    ]);
  });

  it('filtert nach Kategorie und Suchtext, auch in der Beschreibung', () => {
    expect(filterTemplates(alle, { ...NO_FILTER, categoryId: 'kaelte' }, new Set())).toEqual([kalt]);
    expect(filterTemplates(alle, { ...NO_FILTER, query: 'ANHALTEN' }, new Set())).toEqual([bolt]);
  });
});

describe('groupByCategory', () => {
  const kategorien = [category('kaelte', 2), category('atmung', 1), category('leer', 3)];

  it('folgt der Reihenfolge der Kategorien und laesst leere weg', () => {
    const groups = groupByCategory(
      [...kategorien].sort((a, b) => a.sort_order - b.sort_order),
      alle,
      new Set(),
    );
    expect(groups.map((g) => g.category.id)).toEqual(['atmung', 'kaelte']);
  });

  it('stellt Favoriten innerhalb der Kategorie nach oben, eigene ans Ende', () => {
    const eigenes = template('Eigenes', { owner_id: 'ich', sort_order: 0 });
    const [atmung] = groupByCategory([category('atmung', 1)], [eigenes, bolt, schlaf], new Set(['Einschlafen']));
    expect(atmung.templates.map((t) => t.id)).toEqual(['Einschlafen', 'BOLT', 'Eigenes']);
  });
});
