import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWakeLock } from './useWakeLock';

type Sentinel = { released: boolean; release: () => Promise<void> };

function apiMitSentinel() {
  const release = vi.fn(async () => {
    sentinel.released = true;
  });
  const sentinel: Sentinel = { released: false, release };
  const request = vi.fn(async () => sentinel);

  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
    writable: true,
  });

  return { request, release, sentinel };
}

afterEach(() => {
  // @ts-expect-error - die Eigenschaft gibt es in jsdom nicht von Haus aus
  delete navigator.wakeLock;
  vi.restoreAllMocks();
});

describe('useWakeLock', () => {
  beforeEach(() => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  it('fordert die Sperre an, sobald geatmet wird', async () => {
    const { request } = apiMitSentinel();

    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
  });

  it('fordert nichts an, solange die Uebung steht', () => {
    const { request } = apiMitSentinel();

    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('gibt die Sperre wieder frei', async () => {
    const { request, release } = apiMitSentinel();

    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalled());

    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  // Der Browser nimmt die Sperre beim Tabwechsel von selbst weg. Ohne die
  // erneute Anforderung waere der Bildschirm nach der ersten Rueckkehr wieder
  // ungeschuetzt - und niemandem waere klar, warum.
  it('fordert sie nach der Rueckkehr in den Tab erneut an', async () => {
    const { request } = apiMitSentinel();

    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  // Safari kann die API erst seit 16.4, Firefox lange nicht. Fehlt sie, laeuft
  // die Uebung wie bisher - nur eben ohne wachen Bildschirm.
  it('kommt ohne die API aus, statt zu werfen', () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
