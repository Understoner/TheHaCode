import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSessionKeepAlive } from './audioSession';

// Ob die Wachhaltung auf einem iPhone die gewuenschte Wirkung hat, kann kein
// Test beantworten - das hat ein Geraet beantwortet. Pruefbar ist, was in
// unserer Hand liegt: dass sie nur dort laeuft, wo sie gebraucht wird, dass
// nichts zu hoeren ist, und dass sie sich wieder abschalten laesst.

const echterNavigator = globalThis.navigator;

type Gespielt = { src: string; loop: boolean; plays: number; pauses: number };
const gespielt: Gespielt[] = [];

function umgebung({ safari }: { safari: boolean }) {
  Object.defineProperty(globalThis, 'navigator', {
    value: safari ? { audioSession: { type: 'auto' } } : {},
    configurable: true,
  });

  vi.stubGlobal(
    'Audio',
    class {
      src: string;
      loop = false;
      constructor(src: string) {
        this.src = src;
        gespielt.push({ src, loop: false, plays: 0, pauses: 0 });
      }
      private get eintrag() {
        return gespielt[gespielt.length - 1];
      }
      play() {
        this.eintrag.loop = this.loop;
        this.eintrag.plays += 1;
        return Promise.resolve();
      }
      pause() {
        this.eintrag.pauses += 1;
      }
    },
  );

  vi.stubGlobal('btoa', (s: string) => Buffer.from(s, 'binary').toString('base64'));
}

function stubContext() {
  const gains: { value: number }[] = [];
  const knoten = () => ({ connect: (z: unknown) => z, disconnect: () => undefined });
  const ctx = {
    destination: knoten(),
    createMediaElementSource: () => knoten(),
    createGain: () => {
      const g = { value: 0 };
      gains.push(g);
      return { ...knoten(), gain: g };
    },
  } as unknown as AudioContext;
  return { ctx, gains };
}

afterEach(() => {
  gespielt.length = 0;
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, 'navigator', { value: echterNavigator, configurable: true });
});

describe('createSessionKeepAlive', () => {
  it('spielt auf Safari einen Schnipsel in Schleife', () => {
    umgebung({ safari: true });
    const { ctx } = stubContext();

    createSessionKeepAlive().start(ctx);

    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].src).toMatch(/^data:audio\/wav;base64,/);
    expect(gespielt[0].loop, 'in Schleife, sonst endet die Wachhaltung nach einer halben Sekunde').toBe(true);
    expect(gespielt[0].plays).toBe(1);
  });

  // Die Wachhaltung greift den Audiofokus. Wo das Problem nicht existiert,
  // waere das reiner Schaden - auf Android hielte es die Musik des Nutzers an,
  // ohne dass jemand etwas davon haette.
  it('laeuft nirgends sonst', () => {
    umgebung({ safari: false });
    const { ctx } = stubContext();

    createSessionKeepAlive().start(ctx);

    expect(gespielt).toHaveLength(0);
  });

  it('haengt den Schnipsel an einen Verstaerker auf null', () => {
    umgebung({ safari: true });
    const { ctx, gains } = stubContext();

    createSessionKeepAlive().start(ctx);

    expect(gains).toHaveLength(1);
    expect(gains[0].value).toBe(0);
  });

  // Zweite Vorkehrung neben dem Verstaerker: der Inhalt selbst ist unhoerbar.
  // Faellt die eine aus, traegt die andere.
  it('erzeugt einen Schnipsel, der auch ungeregelt unhoerbar waere', () => {
    umgebung({ safari: true });
    createSessionKeepAlive().start(null);

    const base64 = gespielt[0].src.split(',')[1];
    const roh = Buffer.from(base64, 'base64');
    let spitze = 0;
    for (let i = 44; i < roh.length; i += 2) {
      spitze = Math.max(spitze, Math.abs(roh.readInt16LE(i)));
    }

    // Rund -60 dBFS: unhoerbar, aber nicht digitale Stille - manche Systeme
    // behandeln die anders.
    expect(spitze).toBeGreaterThan(0);
    expect(spitze).toBeLessThan(64);
  });

  it('startet nicht zweimal und laesst sich anhalten', () => {
    umgebung({ safari: true });
    const { ctx } = stubContext();
    const keepAlive = createSessionKeepAlive();

    keepAlive.start(ctx);
    keepAlive.start(ctx);
    expect(gespielt, 'ein Element, nicht zwei').toHaveLength(1);
    expect(gespielt[0].plays).toBe(2);

    keepAlive.stop();
    expect(gespielt[0].pauses).toBe(1);
  });
});
