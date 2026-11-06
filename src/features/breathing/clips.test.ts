import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClipPlayer, OUTRO_TO_END_MS, outroOffsetSeconds } from './clips';

describe('outroOffsetSeconds', () => {
  // 15 Minuten, 15 Sekunden Ausklang: Er laeuft von 860 s bis 875 s, 25 s vor dem Ende.
  const total = 900_000;
  const clip = 15_000;

  it('ist vor dem Einsatz null', () => {
    expect(outroOffsetSeconds(859_999, total, clip)).toBeNull();
  });
  it('endet 25 Sekunden vor der letzten Atemphase', () => {
    expect(OUTRO_TO_END_MS).toBe(25_000);
    expect(outroOffsetSeconds(860_000, total, clip)).toBe(0);
    expect(outroOffsetSeconds(870_000, total, clip)).toBe(10);
  });
  it('startet danach nicht noch einmal', () => {
    expect(outroOffsetSeconds(875_000, total, clip)).toBeNull();
    expect(outroOffsetSeconds(899_000, total, clip)).toBeNull();
  });
  it('entfaellt, wenn er vor der Haelfte der Session beginnen muesste', () => {
    expect(outroOffsetSeconds(21_000, 60_000, clip)).toBeNull();
    expect(outroOffsetSeconds(40_000, 80_000, clip)).toBe(0);
    expect(outroOffsetSeconds(39_000, 79_000, clip)).toBeNull();
  });
});

describe('createClipPlayer', () => {
  const started: { offset: number; source: { onended: (() => void) | null } }[] = [];
  let stopped = 0;
  const ctx = {
    currentTime: 0,
    destination: {},
    createGain: () => ({ connect: () => undefined, gain: { value: 0, setTargetAtTime: () => undefined } }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        onended: null as (() => void) | null,
        connect: () => undefined,
        start: (_when: number, offset: number) => started.push({ offset, source }),
        stop: () => {
          stopped += 1;
        },
      };
      return source;
    },
    decodeAudioData: () => Promise.resolve({ duration: 12 }),
  } as unknown as AudioContext;

  beforeEach(() => {
    started.length = 0;
    stopped = 0;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('spielt erst nach dem Laden und meldet das Ende', async () => {
    const clips = createClipPlayer(ctx);
    const ended = vi.fn();
    expect(clips.play('/a', 0, ended)).toBe(false);
    expect(await clips.load('/a')).toBe(true);
    expect(clips.durationMs('/a')).toBe(12_000);
    expect(clips.play('/a', 3, ended)).toBe(true);
    expect(started[0].offset).toBe(3);
    expect(clips.isPlaying()).toBe(true);
    started[0].source.onended?.();
    expect(ended).toHaveBeenCalledOnce();
    expect(clips.isPlaying()).toBe(false);
  });

  it('meldet beim Abbrechen kein Ende', async () => {
    const clips = createClipPlayer(ctx);
    const ended = vi.fn();
    await clips.load('/a');
    clips.play('/a', 0, ended);
    clips.stop();
    expect(stopped).toBe(1);
    expect(started[0].source.onended).toBeNull();
    expect(ended).not.toHaveBeenCalled();
  });

  it('meldet eine fehlende Datei, statt zu werfen', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    expect(await createClipPlayer(ctx).load('/fehlt')).toBe(false);
  });
});
