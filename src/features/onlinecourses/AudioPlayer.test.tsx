import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { AudioPlayer, formatTime } from './AudioPlayer';

// jsdom spielt nichts ab: ein kleines Audio-Double, das die Ereignisse
// meldet, auf die der Player hoert.
class FakeAudio extends EventTarget {
  static last: FakeAudio | null = null;
  src = '';
  preload = '';
  paused = true;
  currentTime = 0;
  duration = 120;
  constructor() {
    super();
    FakeAudio.last = this;
  }
  play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  removeAttribute() {}
}

const request = vi.fn(async () => ({ released: false, release: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true, writable: true });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error - in jsdom nicht vorhanden
  delete navigator.wakeLock;
  request.mockClear();
  FakeAudio.last = null;
});

describe('formatTime', () => {
  it('zeigt Minuten und Sekunden', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('AudioPlayer', () => {
  it('spielt ab und haelt dabei den Bildschirm wach', async () => {
    render(<AudioPlayer src="https://example.test/a.mp3" title="Box-Atmung" durationSec={480} />);

    expect(screen.getByText(/Auf dem iPhone stoppt sie/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Abspielen'));

    await screen.findByText(/Bitte sperr dein Handy nicht/);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
  });

  it('meldet das Ende genau einmal, damit der Block abgehakt wird', async () => {
    const onEnded = vi.fn();
    render(<AudioPlayer src="https://example.test/a.mp3" title="x" onEnded={onEnded} />);

    act(() => {
      FakeAudio.last!.dispatchEvent(new Event('ended'));
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('spult 15 Sekunden, aber nie vor den Anfang', () => {
    render(<AudioPlayer src="https://example.test/a.mp3" title="x" />);
    const audio = FakeAudio.last!;

    fireEvent.click(screen.getByLabelText('15 Sekunden vor'));
    expect(audio.currentTime).toBe(15);
    fireEvent.click(screen.getByLabelText('15 Sekunden zurück'));
    fireEvent.click(screen.getByLabelText('15 Sekunden zurück'));
    expect(audio.currentTime).toBe(0);
  });

  it('bietet bei einem Fehler einen neuen Versuch an', () => {
    const onRetry = vi.fn();
    render(<AudioPlayer src="https://example.test/a.mp3" title="x" onRetry={onRetry} />);

    act(() => {
      FakeAudio.last!.dispatchEvent(new Event('error'));
    });
    fireEvent.click(screen.getByText('Noch einmal laden'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sagt, wenn die Aufnahme fehlt', () => {
    render(<AudioPlayer src={null} title="x" />);
    expect(screen.getByText('Die Aufnahme ist noch nicht da')).toBeTruthy();
  });
});
