import { describe, expect, it } from 'vitest';

import { enabledCategoryIds, isAreaEnabled, toggleArea } from './habitAreas';

const CATS = [
  { id: 'a', slug: 'atmung' },
  { id: 'e', slug: 'ernaehrung' },
  { id: 's', slug: 'schlaf' },
];

describe('Habit-Bereiche', () => {
  it('kennt fuer neue Konten nur Atmung', () => {
    expect([...enabledCategoryIds(CATS, ['atmung'])]).toEqual(['a']);
  });

  it('zeigt bestehenden Konten (NULL) alle Bereiche', () => {
    expect([...enabledCategoryIds(CATS, null)]).toEqual(['a', 'e', 's']);
  });

  it('haelt Atmung immer eingeschaltet', () => {
    expect(isAreaEnabled('atmung', [])).toBe(true);
    expect(toggleArea(CATS, ['atmung', 'schlaf'], 'atmung', false)).toEqual(['atmung', 'schlaf']);
  });

  it('schaltet einen Bereich dazu und wieder weg', () => {
    expect(toggleArea(CATS, ['atmung'], 'schlaf', true)).toEqual(['atmung', 'schlaf']);
    expect(toggleArea(CATS, ['atmung', 'schlaf'], 'schlaf', false)).toEqual(['atmung']);
  });

  it('macht aus "alle" eine Liste ohne den abgeschalteten Bereich', () => {
    expect(toggleArea(CATS, null, 'ernaehrung', false)).toEqual(['atmung', 'schlaf']);
  });
});
