import { describe, expect, it } from 'vitest';

import { createToneBus } from './tones';

// Wie ein Ton KLINGT, kann kein Test beurteilen. Was er pruefen kann, ist der
// Klanggraph dahinter - und genau der traegt die Eigenschaften, die eine
// Handpan ausmachen: gestimmte Teiltoene auf Oktave und Duodezime, je Teilton
// ein Modenpaar mit leichter Verstimmung (die Schwebung, ohne die es
// synthetisch klingt), leise mitschwingende Nachbarfelder, ein
// Anschlagsgeraeusch, ein mitfallender Tiefpass und ein Nachhall.
//
// Der Stub zeichnet auf, statt zu klingen. jsdom hat keine Web Audio API.

type Huellkurve = { spitzen: number[]; klingtAus: boolean };

type Aufzeichnung = {
  oszillatoren: { ziel: number; typ: string }[];
  huellkurven: Huellkurve[];
  rauschen: number;
  filter: string[];
  faltung: number;
  faltungNormiert: boolean | null;
  panorama: number[];
  puffer: Float32Array[][];
};

function stubContext(): { ctx: BaseAudioContext; auf: Aufzeichnung } {
  const auf: Aufzeichnung = {
    oszillatoren: [],
    huellkurven: [],
    rauschen: 0,
    filter: [],
    faltung: 0,
    faltungNormiert: null,
    panorama: [],
    puffer: [],
  };

  /** Ein AudioParam, das sich merkt, was mit ihm geschehen ist. */
  const param = (aufzeichnen?: (v: number, art: 'setzen' | 'linear' | 'exp') => void) => ({
    value: 0,
    cancelScheduledValues: () => undefined,
    setValueAtTime: (v: number) => aufzeichnen?.(v, 'setzen'),
    linearRampToValueAtTime: (v: number) => aufzeichnen?.(v, 'linear'),
    exponentialRampToValueAtTime: (v: number) => aufzeichnen?.(v, 'exp'),
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

    createGain: () => {
      // Eine Huellkurve erkennt man am Ausklang: nur sie faehrt exponentiell
      // gegen Null. Summenverstaerker und Nebenweg tun das nicht.
      const rec: Huellkurve = { spitzen: [], klingtAus: false };
      auf.huellkurven.push(rec);
      return {
        ...knoten(),
        gain: param((v, art) => {
          if (art === 'linear') rec.spitzen.push(v);
          if (art === 'exp') rec.klingtAus = true;
        }),
      };
    },

    createBiquadFilter: () => {
      const i = auf.filter.push('') - 1;
      return {
        ...knoten(),
        set type(v: string) {
          auf.filter[i] = v;
        },
        get type() {
          return auf.filter[i];
        },
        frequency: param(),
        Q: { value: 0 },
      };
    },

    createStereoPanner: () => {
      const i = auf.panorama.push(0) - 1;
      return {
        ...knoten(),
        pan: {
          get value() {
            return auf.panorama[i];
          },
          set value(v: number) {
            auf.panorama[i] = v;
          },
        },
      };
    },

    createConvolver: () => {
      auf.faltung += 1;
      return {
        ...knoten(),
        buffer: null,
        set normalize(v: boolean) {
          auf.faltungNormiert = v;
        },
      };
    },

    createBuffer: (kanaele: number, len: number) => {
      const daten = Array.from({ length: kanaele }, () => new Float32Array(len));
      auf.puffer.push(daten);
      return { getChannelData: (k: number) => daten[k] };
    },

    createBufferSource: () => {
      auf.rauschen += 1;
      return { ...knoten(), buffer: null, start: () => undefined, stop: () => undefined };
    },
  } as unknown as BaseAudioContext;

  return { ctx, auf };
}

/** Ein Anschlag bei voller Lautstaerke, damit die Pegel unverrechnet dastehen. */
function anschlag(kind: 'inhale' | 'hold_in' | 'exhale' | 'hold_out' | 'free_breathing', ms = 6000) {
  const { ctx, auf } = stubContext();
  createToneBus(ctx, 1).strike(kind, ms);
  return { auf };
}

/** Frequenzen, gruppiert nach Vielfachem des Grundtons. */
function teiltoene(frequenzen: number[], grundton: number) {
  const gruppen = new Map<number, number[]>();
  for (const f of frequenzen) {
    const verhaeltnis = Math.round((f / grundton) * 100) / 100;
    gruppen.set(verhaeltnis, [...(gruppen.get(verhaeltnis) ?? []), f]);
  }
  return gruppen;
}

const A3 = 220; // der einzige Ton, seit dem 06.09.2026

describe('createToneBus', () => {
  it('nimmt fuer jeden Phasenwechsel denselben Ton', () => {
    const grundtoene = (['inhale', 'hold_in', 'exhale', 'hold_out'] as const).map((kind) => {
      const { auf } = anschlag(kind);
      return Math.min(...auf.oszillatoren.map((o) => o.ziel).filter((f) => f > 100));
    });

    // Vier Phasen, eine Tonhoehe: der Wechsel wird markiert, nicht vertont.
    expect(new Set(grundtoene).size).toBe(1);
    expect(grundtoene[0]).toBeCloseTo(A3, 0);
  });

  it('stimmt Oktave und Duodezime - darauf ist eine Handpan gestimmt', () => {
    const { auf } = anschlag('inhale');
    const gruppen = teiltoene(
      auf.oszillatoren.map((o) => o.ziel).filter((f) => f > A3 * 0.7),
      A3,
    );

    expect([...gruppen.keys()]).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it('gibt jedem gestimmten Teilton ein Modenpaar - das erzeugt die Schwebung', () => {
    const { auf } = anschlag('inhale');
    const gruppen = teiltoene(
      auf.oszillatoren.map((o) => o.ziel).filter((f) => f > A3 * 0.7),
      A3,
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

  it('laesst zwei Nachbarfelder leise mitschwingen', () => {
    const { auf } = anschlag('inhale');

    // Nachbarfelder liegen zwischen Grundton und Oktave und stehen in keinem
    // ganzzahligen Verhaeltnis - sie sind eigene Toene der Stimmung, keine
    // Teiltoene des angeschlagenen Feldes.
    const nachbarn = auf.oszillatoren
      .map((o) => o.ziel)
      .filter((f) => f > A3 * 1.05 && f < A3 * 1.95);

    expect(nachbarn).toHaveLength(2);
  });

  it('schlaegt mit gefiltertem Rauschen an, wird dunkler und steht in einem Raum', () => {
    const { auf } = anschlag('inhale');

    expect(auf.rauschen, 'Anschlagsgeraeusch').toBe(1);
    expect(auf.filter).toContain('lowpass');
    expect(auf.filter).toContain('bandpass');
    expect(auf.faltung, 'Nachhall').toBe(1);
  });

  // Eine Faltung summiert ueber die ganze Impulsantwort. Unnormiert kaeme aus
  // knapp zwei Sekunden Rauschen rund das Vierzigfache dessen zurueck, was
  // hineingeht - der Nachhall wuerde den Anschlag verschlucken und den Ausgang
  // uebersteuern. Bei Quadratsumme eins bedeutet der Nebenweg das, was an ihm
  // steht.
  it('gibt dem Nachhall nicht mehr Pegel, als hineingeht', () => {
    const { ctx, auf } = stubContext();
    createToneBus(ctx, 1);

    expect(auf.faltungNormiert, 'eigene Normierung statt der des Browsers').toBe(false);

    const antwort = auf.puffer.find((kanaele) => kanaele.length === 2);
    expect(antwort, 'die Impulsantwort ist zweikanalig - das ist die Breite').toBeTruthy();

    for (const kanal of antwort ?? []) {
      const energie = kanal.reduce((summe, wert) => summe + wert * wert, 0);
      expect(energie).toBeCloseTo(1, 4);
    }
  });

  // DER FEHLER, DER DEN LAUTSTAERKEREGLER WIRKUNGSLOS AUSSEHEN LIESS
  // ---------------------------------------------------------------
  // Die Teiltoene summierten sich auf ueber das Doppelte der Vollaussteuerung,
  // und der Ausgang kappt hart bei eins. Ab etwa 70 Prozent Reglerstellung
  // wurde nichts mehr lauter, nur noch verzerrt.
  it('bleibt in der Summe unter der Vollaussteuerung', () => {
    const { auf } = anschlag('inhale');

    const summe = auf.huellkurven
      .filter((h) => h.klingtAus)
      .reduce((total, h) => total + Math.max(...h.spitzen, 0), 0);

    expect(summe).toBeGreaterThan(0.2); // hoerbar soll es trotzdem sein
    expect(summe).toBeLessThanOrEqual(1);
  });

  it('regelt die Lautstaerke an einer Stelle, nicht am einzelnen Ton', () => {
    const { ctx, auf } = stubContext();
    const bus = createToneBus(ctx, 0.5);

    // Der Summenverstaerker ist der erste Gain-Knoten des Busses. Eine
    // Aenderung faehrt ihn an - ohne dass ein Ton angeschlagen wurde.
    const master = auf.huellkurven[0];
    expect(master.spitzen).toEqual([]);

    bus.setVolume(0.9);
    expect(master.spitzen.at(-1)).toBeCloseTo(0.9, 5);

    bus.silence();
    expect(master.spitzen.at(-1)).toBe(0);
  });

  it('kappt Werte ausserhalb von 0 bis 1', () => {
    const { ctx, auf } = stubContext();
    const bus = createToneBus(ctx, 0.5);
    const master = auf.huellkurven[0];

    bus.setVolume(4);
    expect(master.spitzen.at(-1)).toBe(1);

    bus.setVolume(-2);
    expect(master.spitzen.at(-1)).toBe(0);
  });

  it('bleibt bei zu kurzen Phasen stumm, damit Toene nicht stolpern', () => {
    const { auf } = anschlag('inhale', 900);

    expect(auf.oszillatoren).toHaveLength(0);
    expect(auf.rauschen).toBe(0);
  });

  it('schweigt bei freier Atmung - dort gibt es keinen Phasenwechsel anzuzeigen', () => {
    const { auf } = anschlag('free_breathing');

    expect(auf.oszillatoren).toHaveLength(0);
  });
});
