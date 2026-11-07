import { describe, expect, it } from 'vitest';

import type { ValueRule } from '@/features/habits/valuePoints';

import { niceDomain, smoothPath, zoneEdges, zoneKind, zonesFor } from './chartMath';

const rule = (over: Partial<ValueRule>): ValueRule => ({
  tracking_type: 'number',
  points: 6,
  is_negative: false,
  higher_is_better: true,
  points_from: null,
  penalty_from: null,
  penalty_points: null,
  partial_points: null,
  ...over,
});

const steps = rule({ points_from: 5000, penalty_from: 3000, penalty_points: 4 });
const sleep = rule({ points: 8, points_from: 7, penalty_from: 6, penalty_points: 8, partial_points: 4 });

describe('zonesFor', () => {
  it('Schritte: Punkte ab 5.000, neutral dazwischen, Abzug unter 3.000', () => {
    expect(zonesFor(steps)).toEqual([
      { lo: 5000, hi: Infinity, kind: 'good' },
      { lo: 3000, hi: 5000, kind: 'neutral' },
      { lo: -Infinity, hi: 3000, kind: 'bad' },
    ]);
  });

  it('Schlafdauer: Teilpunkte zwischen 6 und 7', () => {
    expect(zonesFor(sleep).map((z) => z.kind)).toEqual(['good', 'partial', 'bad']);
  });

  it('nur Plus-Grenze (Etagen): Punkte und ohne Punkte', () => {
    expect(zonesFor(rule({ points_from: 10 }))).toEqual([
      { lo: 10, hi: Infinity, kind: 'good' },
      { lo: -Infinity, hi: 10, kind: 'neutral' },
    ]);
  });

  it('weniger ist besser: Punkte unten, Abzug oben', () => {
    const screen = rule({ higher_is_better: false, points_from: 60, penalty_from: 120, penalty_points: 3 });
    expect(zonesFor(screen).map((z) => z.kind)).toEqual(['bad', 'neutral', 'good']);
  });

  it('ohne Grenzen oder fuer Gesundheitswerte: keine Zonen', () => {
    expect(zonesFor(null)).toEqual([]);
    expect(zonesFor(rule({}))).toEqual([]);
    expect(zonesFor(rule({ points_from: 10, is_negative: true }))).toEqual([]);
  });

  it('Grenzen fuer die gestrichelten Linien', () => {
    expect(zoneEdges(zonesFor(steps))).toEqual([
      { value: 5000, above: 'good', below: 'neutral' },
      { value: 3000, above: 'neutral', below: 'bad' },
    ]);
  });
});

describe('zoneKind', () => {
  it('rechnet wie der Score - Grenzwert selbst bringt Punkte', () => {
    expect(zoneKind(steps, 5000)).toBe('good');
    expect(zoneKind(steps, 4999)).toBe('neutral');
    expect(zoneKind(steps, 2999)).toBe('bad');
    expect(zoneKind(sleep, 6.5)).toBe('partial');
  });
});

describe('niceDomain', () => {
  it('Gewicht beginnt nicht bei 0', () => {
    const d = niceDomain([80.2, 80.9, 81.6]);
    expect(d.lo).toBeGreaterThan(79);
    expect(d.hi).toBeLessThan(83);
    expect(d.ticks[0]).toBe(d.lo);
    expect(d.ticks[d.ticks.length - 1]).toBe(d.hi);
  });

  it('nimmt Punktegrenzen in den Bereich auf', () => {
    const d = niceDomain([6000, 9000], [3000, 5000]);
    expect(d.lo).toBeLessThanOrEqual(3000);
    expect(d.hi).toBeGreaterThanOrEqual(9000);
  });

  it('geht nicht unter 0, wenn kein Wert darunter liegt', () => {
    expect(niceDomain([0, 2, 30]).lo).toBe(0);
  });

  it('ein einzelner Wert bekommt trotzdem einen Bereich', () => {
    const d = niceDomain([72]);
    expect(d.lo).toBeLessThan(72);
    expect(d.hi).toBeGreaterThan(72);
  });
});

describe('smoothPath', () => {
  it('schiesst nicht ueber: flache Stelle bleibt flach', () => {
    const d = smoothPath([
      [0, 10],
      [10, 10],
      [20, 30],
    ]);
    // Erste Kurve zwischen zwei gleichen Werten: Kontrollpunkte auf y = 10.
    expect(d.startsWith('M0,10 C3.3,10 6.7,10 10,10')).toBe(true);
  });

  it('ein Punkt ist ein Startpunkt, keiner ist leer', () => {
    expect(smoothPath([[5, 6]])).toBe('M5,6');
    expect(smoothPath([])).toBe('');
  });
});
