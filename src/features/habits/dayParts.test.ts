import { describe, expect, it } from 'vitest';

import { dayPartOf, groupByDayPart } from './dayParts';

describe('dayPartOf', () => {
  it('ohne oder mit unbekanntem Wert ist es tagsueber', () => {
    expect(dayPartOf(null)).toBe('tagsueber');
    expect(dayPartOf('nachts')).toBe('tagsueber');
    expect(dayPartOf('morgens')).toBe('morgens');
    expect(dayPartOf('abends')).toBe('abends');
  });
});

describe('groupByDayPart', () => {
  it('ordnet morgens, tagsueber, abends und laesst leere Gruppen weg', () => {
    const items = [
      { id: 'a', part: 'abends' },
      { id: 'b', part: null },
      { id: 'c', part: 'abends' },
    ];
    expect(groupByDayPart(items, (i) => i.part)).toEqual([
      { part: 'tagsueber', items: [items[1]] },
      { part: 'abends', items: [items[0], items[2]] },
    ]);
  });
});
