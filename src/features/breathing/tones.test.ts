import { describe, expect, it } from 'vitest';

import { playCue } from './tones';

// Wie ein Ton KLINGT, kann kein Test beurteilen. Was er pruefen kann, ist der
// Klanggraph dahinter - und genau der traegt die Eigenschaften, die eine
// Handpan ausmachen: gestimmte Teiltoene auf Oktave und Duodezime, je Teilton
// ein Modenpaar mit leichter Verstimmung (die Schwebung, ohne die es
// synthetisch klingt), ein Anschlagsgeraeusch und ein mitfallender Tiefpass.
//
// Der Stub zeichnet auf, statt zu klingen. jsdom hat keine Web Audio API.

type Aufzeichnung = {
  oszillatoren: { ziel: number; typ: string }[];
  rauschen: number;
  filter: string[];
};

function stubContext(): { ctx: BaseAudioContext; auf: Aufzeichnung } {
  const auf: Aufzeichnung = { oszillatoren: [], rauschen: 0, filter: [] };

  const param = (onSet?: (v: number) => void) => ({
    value: 0,
    setValueAtTime: (v: number) => onSet?.(v),
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: (v: number) => onSet?.(v),
  });

  const knoten = () => ({ connect: (z: unknown) => z, disconnect: () => undefined });

  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: knoten(),
    createOscillator: () => {
      const rec = { ziel: 0, typ: 'sine' };
      auf.oszillatoren.push(rec);
      return {
        ...knoten(),
        set type(v: string) {
          rec.typ = v;
        },
        // Die Ruhetonhoehe ist der Wert, auf den nach dem Anschlag gefahren
        // wird - deshalb zaehlt der letzte gesetzte Wert.
        frequency: param((v) => {
          rec.ziel = v;
        }),
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createGain: () => ({ ...knoten(), gain: param() }),
    createBiquadFilter: () => {
      const rec = { type: '' };
      auf.filter.push('');
      const i = auf.filter.length - 1;
      return {
        ...knoten(),
        set type(v: string) {
          rec.type = v;
          auf.filter[i] = v;
        },
        get type() {
          return rec.type;
        },
        frequency: param(),
        Q: { value: 0 },
      };
    },
    createBuffer: (_c: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    }),
    createBufferSource: () => {
      auf.rauschen += 1;
      return { ...knoten(), buffer: null, start: () => undefined, stop: () => undefined };
    },
  } as unknown as BaseAudioContext;

  return { ctx, auf };
}

/** Frequenzen, gruppiert nach Vielfachem des Grundtons. */
function teiltoene(frequenzen: number[], grundton: number) {
  const gruppen = new Map<number, number[]>();
  for (const f of frequenzen) {
    const verhaeltnis = Math.round((f / grundton) * 10) / 10;
    gruppen.set(verhaeltnis, [...(gruppen.get(verhaeltnis) ?? []), f]);
  }
  return gruppen;
}

const A3 = 220; // Grundton der Einatmen-Phase

describe('playCue', () => {
  it('stimmt Oktave und Duodezime - darauf ist eine Handpan gestimmt', () => {
    const { ctx, auf } = stubContext();
    playCue(ctx, 'inhale', 6000);

    const gruppen = teiltoene(
      auf.oszillatoren.map((o) => o.ziel).filter((f) => f > A3 * 0.7),
      A3
    );

    expect([...gruppen.keys()]).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it('gibt jedem gestimmten Teilton ein Modenpaar - das erzeugt die Schwebung', () => {
    const { ctx, auf } = stubContext();
    playCue(ctx, 'inhale', 6000);

    const gruppen = teiltoene(
      auf.oszillatoren.map((o) => o.ziel).filter((f) => f > A3 * 0.7),
      A3
    );

    for (const verhaeltnis of [1, 2, 3]) {
      const paar = gruppen.get(verhaeltnis) ?? [];
      expect(paar, `Teilton ${verhaeltnis}f ist ein Paar`).toHaveLength(2);

      const schwebung = Math.abs(paar[0] - paar[1]);
      // Hoerbar langsam: unter etwa 0,3 Hz merkt man nichts, ueber 4 Hz
      // klingt es nach Verstimmung statt nach lebendigem Metall.
      expect(schwebung, `Schwebung bei ${verhaeltnis}f`).toBeGreaterThan(0.3);
      expect(schwebung, `Schwebung bei ${verhaeltnis}f`).toBeLessThan(4);
    }
  });

  it('schlaegt mit gefiltertem Rauschen an und macht den Klang danach dunkler', () => {
    const { ctx, auf } = stubContext();
    playCue(ctx, 'inhale', 6000);

    expect(auf.rauschen, 'Anschlagsgeraeusch').toBe(1);
    expect(auf.filter).toContain('lowpass');
    expect(auf.filter).toContain('bandpass');
  });

  it('bleibt bei zu kurzen Phasen stumm, damit Toene nicht stolpern', () => {
    const { ctx, auf } = stubContext();
    playCue(ctx, 'inhale', 900);

    expect(auf.oszillatoren).toHaveLength(0);
    expect(auf.rauschen).toBe(0);
  });

  it('schweigt bei freier Atmung - dort gibt es keinen Phasenwechsel anzuzeigen', () => {
    const { ctx, auf } = stubContext();
    playCue(ctx, 'free_breathing', 6000);

    expect(auf.oszillatoren).toHaveLength(0);
  });

  it('gibt jeder Phase eine eigene Tonhoehe', () => {
    const grundtoene = (['inhale', 'hold_in', 'exhale', 'hold_out'] as const).map((kind) => {
      const { ctx, auf } = stubContext();
      playCue(ctx, kind, 6000);
      return Math.min(...auf.oszillatoren.map((o) => o.ziel).filter((f) => f > 100));
    });

    expect(new Set(grundtoene).size, 'vier verschiedene Grundtoene').toBe(4);
    // Das leere Halten liegt am tiefsten: der Klang kommt am Ende des
    // Atemzugs zur Ruhe, nicht schon beim Ausatmen.
    expect(Math.min(...grundtoene)).toBe(grundtoene[3]);
  });
});
