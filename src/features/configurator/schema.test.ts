import { describe, expect, it } from 'vitest';

import de from '@/i18n/locales/de/errors.json';
import { emptySequence, sequenceSchema, type SequenceFormValues } from './schema';

function fehler(werte: SequenceFormValues): string[] {
  const ergebnis = sequenceSchema.safeParse(werte);
  return ergebnis.success ? [] : ergebnis.error.issues.map((issue) => issue.message);
}

describe('sequenceSchema', () => {
  it('nimmt die vorbereitete Box-Atmung an', () => {
    const werte = { ...emptySequence(), title: 'Abends runterkommen' };
    const ergebnis = sequenceSchema.safeParse(werte);

    expect(ergebnis.success).toBe(true);
    expect(ergebnis.success && ergebnis.data.steps[0].repeat_count).toBe(8);
  });

  // Die App zeigt Dauern selbst mit Komma an ("5,5"). Ein Feld, das die eigene
  // Schreibweise nicht annimmt, waere ein Fehler im Formular, nicht beim Nutzer.
  it('versteht Komma und Punkt als Dezimaltrenner', () => {
    const mitKomma = emptySequence();
    mitKomma.title = 'Kohärenz';
    mitKomma.steps[0].phases = [
      { kind: 'inhale', duration_seconds: '5,5' },
      { kind: 'exhale', duration_seconds: '5.5' },
    ];

    const ergebnis = sequenceSchema.safeParse(mitKomma);
    expect(ergebnis.success).toBe(true);
    expect(ergebnis.success && ergebnis.data.steps[0].phases.map((p) => p.duration_seconds)).toEqual(
      [5.5, 5.5]
    );
  });

  it('besteht auf einem Titel', () => {
    expect(fehler({ ...emptySequence(), title: 'A' })).toContain('errors:sequenz.titel');
  });

  it('weist unsinnige Dauern und Rundenzahlen ab', () => {
    const werte = emptySequence();
    werte.title = 'Test';
    werte.steps[0].repeat_count = '0';
    werte.steps[0].phases[0].duration_seconds = '0';

    const meldungen = fehler(werte);
    expect(meldungen).toContain('errors:sequenz.runden');
    expect(meldungen).toContain('errors:sequenz.dauer');
  });

  it('weist Text in einem Zahlenfeld ab, statt daraus NaN zu machen', () => {
    const werte = emptySequence();
    werte.title = 'Test';
    werte.steps[0].repeat_count = 'acht';

    expect(fehler(werte)).toContain('errors:sequenz.runden');
  });

  it('verlangt mindestens eine Phase je Block', () => {
    const werte = emptySequence();
    werte.title = 'Test';
    werte.steps[0].phases = [];

    expect(fehler(werte)).toContain('errors:sequenz.blockBrauchtPhase');
  });

  // Ohne diesen Test faellt ein Tippfehler im Schluessel erst im Browser auf -
  // und zwar als roher Schluessel mitten im Formular.
  it('nennt nur Fehlerschluessel, zu denen es einen deutschen Text gibt', () => {
    const texte = de as Record<string, string>;
    const werte = emptySequence();
    werte.title = '';
    werte.subtitle = 'x'.repeat(200);
    werte.steps[0].label = 'y'.repeat(100);
    werte.steps[0].repeat_count = '999';
    werte.steps[0].rest_seconds = '-1';
    werte.steps[0].phases[0].duration_seconds = '999';

    const meldungen = fehler(werte);
    expect(meldungen.length).toBeGreaterThan(0);
    for (const key of meldungen) {
      expect(texte[key.replace('errors:', '')], `Text fuer ${key} fehlt`).toBeTruthy();
    }
  });
});
