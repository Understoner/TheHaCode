import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVoicePlayer, VOICE_FILES } from './voice';

// jsdom hat weder Web Audio noch fetch mit echten Dateien. Der Stub zeichnet
// auf, statt zu klingen: welche Aufnahme geholt wurde, welche abgespielt wird,
// und was mit dem Verstaerker geschieht.
//
// Damit sich pruefen laesst, WELCHE Aufnahme laeuft, traegt jeder Puffer die
// Adresse, aus der er entstanden ist - der Umweg ueber die Bytes ist genau
// der, den der echte Weg auch nimmt.

type Aufzeichnung = {
  geholt: string[];
  gespielt: string[];
  gestoppt: number;
  pegel: number[];
};

function stubContext() {
  const auf: Aufzeichnung = { geholt: [], gespielt: [], gestoppt: 0, pegel: [] };

  const knoten = () => ({ connect: (z: unknown) => z, disconnect: () => undefined });

  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: knoten(),

    createGain: () => ({
      ...knoten(),
      gain: {
        value: 0,
        cancelScheduledValues: () => undefined,
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: (v: number) => auf.pegel.push(v),
      },
    }),

    createBufferSource: () => {
      let quelle = '';
      return {
        ...knoten(),
        set buffer(b: { url: string } | null) {
          quelle = b?.url ?? '';
        },
        start: () => auf.gespielt.push(quelle),
        stop: () => {
          auf.gestoppt += 1;
        },
      };
    },

    decodeAudioData: (data: ArrayBuffer) => {
      return Promise.resolve({ url: new TextDecoder().decode(data) });
    },
  } as unknown as AudioContext;

  return { ctx, auf };
}

/** Laesst die angestossenen Ladevorgaenge zu Ende laufen. */
const abwarten = () => new Promise((fertig) => setTimeout(fertig, 0));

describe('createVoicePlayer', () => {
  let auf: Aufzeichnung;
  let ctx: AudioContext;

  beforeEach(() => {
    ({ ctx, auf } = stubContext());
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        auf.geholt.push(url);
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new TextEncoder().encode(url).buffer),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ordnet jeder Atemphase ihre eigene Aufnahme zu', () => {
    expect(VOICE_FILES).toEqual({
      inhale: '/stimme/einatmen.wav',
      hold_in: '/stimme/halten-1.wav',
      exhale: '/stimme/ausatmen.wav',
      hold_out: '/stimme/halten-2.wav',
    });
  });

  // Beim Einschalten holen, nicht beim ersten Wechsel: sonst schwiege die
  // erste Phase, waehrend die Datei noch laedt.
  it('holt beim Vorladen alle vier Aufnahmen, jede nur einmal', async () => {
    const stimme = createVoicePlayer(ctx);
    stimme.preload();
    stimme.preload();
    await abwarten();

    expect(auf.geholt.sort()).toEqual(Object.values(VOICE_FILES).sort());
  });

  it('spielt zur Phase die Aufnahme, die zu ihr gehoert', async () => {
    const stimme = createVoicePlayer(ctx);
    stimme.preload();
    await abwarten();

    stimme.speak('exhale');
    expect(auf.gespielt).toEqual(['/stimme/ausatmen.wav']);

    stimme.speak('hold_out');
    expect(auf.gespielt.at(-1)).toBe('/stimme/halten-2.wav');
  });

  // Beim freien Atmen gibt es nichts anzusagen - dort schweigt auch der Ton.
  // Die Pause zwischen zwei Bloecken kommt hier gar nicht erst an: 'rest' ist
  // kein phase_kind, sondern ein Segment der Zeitachse, und der Player laesst
  // es vorher aus.
  it('schweigt beim freien Atmen', async () => {
    const stimme = createVoicePlayer(ctx);
    stimme.preload();
    await abwarten();

    stimme.speak('free_breathing');

    expect(auf.gespielt).toEqual([]);
  });

  // Eine Ansage, die eine Sekunde zu spaet kommt, sagt das Falsche an.
  it('spielt eine noch nicht geladene Aufnahme nicht verspaetet, sondern holt sie', async () => {
    const stimme = createVoicePlayer(ctx);

    stimme.speak('inhale');
    expect(auf.gespielt).toEqual([]);
    await abwarten();

    expect(auf.geholt).toEqual(['/stimme/einatmen.wav']);
    stimme.speak('inhale');
    expect(auf.gespielt).toEqual(['/stimme/einatmen.wav']);
  });

  // Kurze Phasen, oder jemand tippt sich durch die Sequenz: dann hat die neue
  // Ansage recht, sie sagt an, was JETZT dran ist.
  it('bricht die laufende Ansage ab, wenn die naechste faellig wird', async () => {
    const stimme = createVoicePlayer(ctx);
    stimme.preload();
    await abwarten();

    stimme.speak('inhale');
    stimme.speak('hold_in');

    expect(auf.gestoppt).toBe(1);
    expect(auf.gespielt).toEqual(['/stimme/einatmen.wav', '/stimme/halten-1.wav']);
  });

  it('regelt die Lautstaerke an einer Stelle und sofort', () => {
    const stimme = createVoicePlayer(ctx, 0.7);

    stimme.setVolume(0.4);
    expect(auf.pegel.at(-1)).toBeCloseTo(0.4, 5);

    stimme.setVolume(3);
    expect(auf.pegel.at(-1)).toBe(1);
  });

  it('verstummt beim Verlassen des Players', async () => {
    const stimme = createVoicePlayer(ctx);
    stimme.preload();
    await abwarten();

    stimme.speak('inhale');
    stimme.silence();

    expect(auf.gestoppt).toBe(1);
    expect(auf.pegel.at(-1)).toBe(0);
  });

  // Eine Session ohne Ansage ist kein Fehlerfall, der den Player anhalten
  // duerfte - genau wie bei der Musik.
  it('bleibt still, wenn eine Aufnahme fehlt, statt zu scheitern', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));

    const stimme = createVoicePlayer(ctx);
    stimme.preload();
    await abwarten();

    expect(() => stimme.speak('inhale')).not.toThrow();
    expect(auf.gespielt).toEqual([]);
  });
});
