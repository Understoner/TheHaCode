import { describe, expect, it } from 'vitest';

import { pickRituals, ritualMinutes } from './rituals';

const list = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

describe('pickRituals', () => {
  it('ohne Favoriten die ersten drei', () => {
    expect(pickRituals(list, new Set()).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('Favoriten zuerst, in der Reihenfolge der Liste, dann aufgefuellt', () => {
    expect(pickRituals(list, new Set(['e', 'c'])).map((e) => e.id)).toEqual(['c', 'e', 'a']);
  });

  it('Favoriten, die es nicht (mehr) gibt, zaehlen nicht', () => {
    expect(pickRituals(list.slice(0, 2), new Set(['x'])).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('ritualMinutes', () => {
  it('rundet und laesst fehlende Angaben weg', () => {
    expect(ritualMinutes(300)).toBe(5);
    expect(ritualMinutes(20)).toBe(1);
    expect(ritualMinutes(null)).toBeNull();
    expect(ritualMinutes(0)).toBeNull();
  });
});
