import { describe, expect, it } from 'vitest';

import { emptySequence } from './schema';
import { previewDurationMs, previewRhythm } from './preview';

describe('previewDurationMs', () => {
  // Die Vorschau muss dasselbe sagen wie der Player spaeter abspielt -
  // deshalb rechnet sie ueber buildTimeline und nicht mit einer eigenen
  // Formel (Begruendung in preview.ts).
  it('rechnet Box-Atmung 4-4-4-4 ueber acht Runden richtig', () => {
    const werte = emptySequence(); // 4 Phasen a 4 s, 8 Runden, keine Pause

    expect(previewDurationMs(werte)).toBe(8 * 4 * 4 * 1000);
  });

  it('zaehlt die Pause zwischen zwei Bloecken mit', () => {
    const werte = emptySequence();
    werte.steps[0].repeat_count = '1';
    werte.steps[0].rest_seconds = '30';
    werte.steps.push({
      label: '',
      repeat_count: '1',
      rest_seconds: '0',
      phases: [{ kind: 'inhale', duration_seconds: '10' }],
    });

    // Block 1: 4x4 s = 16 s, Pause 30 s, Block 2: 10 s
    expect(previewDurationMs(werte)).toBe(56_000);
  });

  it('versteht Komma-Eingaben, auch bevor das Formular geprueft wurde', () => {
    const werte = emptySequence();
    werte.steps[0].repeat_count = '1';
    werte.steps[0].phases = [
      { kind: 'inhale', duration_seconds: '5,5' },
      { kind: 'exhale', duration_seconds: '5,5' },
    ];

    expect(previewDurationMs(werte)).toBe(11_000);
  });

  // Waehrend des Tippens steht in einem Feld voruebergehend Unsinn oder gar
  // nichts. Die Vorschau darf dann nicht NaN anzeigen oder abstuerzen.
  it('bleibt bei halb ausgefuellten Feldern ruhig', () => {
    const werte = emptySequence();
    werte.steps[0].repeat_count = '';
    werte.steps[0].phases[0].duration_seconds = 'ab';

    const dauer = previewDurationMs(werte);
    expect(Number.isFinite(dauer)).toBe(true);
    expect(dauer).toBeGreaterThanOrEqual(0);
  });
});

describe('previewRhythm', () => {
  it('bildet die Kurzform aus den Phasen des ersten Blocks', () => {
    expect(previewRhythm(emptySequence())).toBe('4-4-4-4');
  });

  it('schreibt Nachkommastellen mit Komma, wie der Rest der App', () => {
    const werte = emptySequence();
    werte.steps[0].phases = [
      { kind: 'inhale', duration_seconds: '5.5' },
      { kind: 'exhale', duration_seconds: '5.5' },
    ];

    expect(previewRhythm(werte)).toBe('5,5-5,5');
  });
});
