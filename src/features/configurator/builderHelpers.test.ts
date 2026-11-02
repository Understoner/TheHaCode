import { describe, expect, it } from 'vitest';

import { sequenceSchema } from '@/features/configurator/schema';

import {
  durationStep,
  formatFormNumber,
  parseFormNumber,
  QUICK_START_IDS,
  quickStartSteps,
  stepCount,
  stepDuration,
} from './builderHelpers';

describe('Zahlen im Formular', () => {
  it('liest Komma und Punkt', () => {
    expect(parseFormNumber('5,5')).toBe(5.5);
    expect(parseFormNumber('4')).toBe(4);
    expect(parseFormNumber('')).toBeNull();
    expect(parseFormNumber('abc')).toBeNull();
  });

  it('schreibt mit Komma ohne unnoetige Stellen', () => {
    expect(formatFormNumber(5.5)).toBe('5,5');
    expect(formatFormNumber(4)).toBe('4');
  });
});

describe('stepDuration', () => {
  it('geht fein bei kurzen, grob bei langen Phasen', () => {
    expect(durationStep(4, 1)).toBe(0.5);
    expect(durationStep(12, 1)).toBe(1);
    expect(durationStep(40, 1)).toBe(5);
    expect(stepDuration('4', 1, 0.5, 120)).toBe('4,5');
    expect(stepDuration('9,5', 1, 0.5, 120)).toBe('10');
    expect(stepDuration('10', -1, 0.5, 120)).toBe('9,5');
    expect(stepDuration('30', 1, 0.5, 120)).toBe('35');
    expect(stepDuration('30', -1, 0.5, 120)).toBe('29');
  });

  it('rastet krumme Werte ein und haelt die Grenzen', () => {
    expect(stepDuration('4,3', 1, 0.5, 120)).toBe('4,5');
    expect(stepDuration('4,3', -1, 0.5, 120)).toBe('4');
    expect(stepDuration('0,5', -1, 0.5, 120)).toBe('0,5');
    expect(stepDuration('120', 1, 0.5, 120)).toBe('120');
    expect(stepDuration('', 1, 0.5, 120)).toBe('1');
  });
});

describe('stepCount', () => {
  it('zaehlt in ganzen Runden und haelt die Grenzen', () => {
    expect(stepCount('8', 1, 1, 200)).toBe('9');
    expect(stepCount('1', -1, 1, 200)).toBe('1');
    expect(stepCount('200', 1, 1, 200)).toBe('200');
  });
});

describe('quickStartSteps', () => {
  it('liefert fuer jedes Muster ein gueltiges Formular', () => {
    for (const id of QUICK_START_IDS) {
      const result = sequenceSchema.safeParse({
        title: 'Test',
        subtitle: '',
        spotify_url: '',
        apple_music_url: '',
        steps: quickStartSteps(id),
      });
      expect(result.success, id).toBe(true);
    }
  });

  it('baut 4-7-8 richtig', () => {
    expect(quickStartSteps('vierSiebenAcht')[0].phases.map((p) => `${p.kind}:${p.duration_seconds}`)).toEqual([
      'inhale:4',
      'hold_in:7',
      'exhale:8',
    ]);
  });
});
