import { afterEach, describe, expect, it, vi } from 'vitest';

import { setAudioSessionType } from './audioSession';

// Was diese Funktion tut, laesst sich vollstaendig pruefen; ob es auf einem
// iPhone die gewuenschte Wirkung hat, nicht. Der Test haelt deshalb das fest,
// was in unserer Hand liegt: dass die Angabe gesetzt wird, wo es sie gibt, und
// dass nichts scheitert, wo es sie nicht gibt.

const echterNavigator = globalThis.navigator;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, 'navigator', {
    value: echterNavigator,
    configurable: true,
  });
});

function navigatorMit(audioSession: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value: audioSession === undefined ? {} : { audioSession },
    configurable: true,
  });
}

describe('setAudioSessionType', () => {
  it('setzt die Kategorie, wo der Browser sie kennt', () => {
    const sitzung = { type: 'auto' };
    navigatorMit(sitzung);

    expect(setAudioSessionType('transient')).toBe(true);
    expect(sitzung.type).toBe('transient');
  });

  it('nimmt sie auch wieder zurueck', () => {
    const sitzung = { type: 'transient' };
    navigatorMit(sitzung);

    expect(setAudioSessionType('auto')).toBe(true);
    expect(sitzung.type).toBe('auto');
  });

  // Alles ausser Safari, Stand September 2026.
  it('tut nichts, wo es die API nicht gibt', () => {
    navigatorMit(undefined);

    expect(setAudioSessionType('transient')).toBe(false);
  });

  // Eine aeltere Fassung der API kennt den Wert vielleicht nicht. Eine Session
  // ohne Ansage ist kein Grund, den Player anzuhalten.
  it('scheitert nicht, wenn der Browser den Wert ablehnt', () => {
    navigatorMit({
      set type(_v: string) {
        throw new TypeError('unbekannter Wert');
      },
      get type() {
        return 'auto';
      },
    });

    expect(() => setAudioSessionType('transient')).not.toThrow();
    expect(setAudioSessionType('transient')).toBe(false);
  });
});
