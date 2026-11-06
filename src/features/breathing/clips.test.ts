import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClipPlayer, outroOffsetSeconds } from './clips';

describe('outroOffsetSeconds', () => {
  it('ist vor dem Einsatz null', () => {
    expect(outroOffsetSeconds(59_999, 90_000, 30_000)).toBeNull();
  });
  it('setzt so ein, dass die Aufnahme mit der letzten Phase endet', () => {
    expect(outroOffsetSeconds(60_000, 90_000, 30_000)).toBe(0);
    expect(outroOffsetSeconds(75_000, 90_000, 30_000)).toBe(15);
  });
  it('ist nach dem Ende null', () => {
    expect(outroOffsetSeconds(90_000, 90_000, 30_000)).toBeNull();
  });
  it('beginnt bei einer zu langen Aufnahme mit der Session', () => {
    expect(outroOffsetSeconds(0, 20_000, 30_000)).toBe(0);
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
