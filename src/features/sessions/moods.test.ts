import { describe, expect, it } from 'vitest';

import {
  daySlot,
  moodsOf,
  parseMood,
  profileKeyframes,
  profilePath,
  sessionKind,
  suggestFor,
} from './moods';

describe('moodsOf', () => {
  it('leitet die Stimmungen der heutigen Sessions aus den Wirkungs-Chips ab', () => {
    expect(moodsOf(['aktivierend'])).toEqual(['wach']);
    expect(moodsOf(['aktivierend', 'co2_toleranz'])).toEqual(['wach', 'fokus']);
    expect(moodsOf(['aktivierend', 'stressreduktion'])).toEqual(['wach', 'fokus']);
    expect(moodsOf(['co2_toleranz'])).toEqual(['fokus']);
    expect(moodsOf(['co2_toleranz', 'stressreduktion'])).toEqual(['fokus', 'ruhig']);
    expect(moodsOf(['stressreduktion', 'entspannend', 'co2_toleranz'])).toEqual(['fokus', 'ruhig']);
    expect(moodsOf(['entspannend', 'stressreduktion'])).toEqual(['ruhig', 'schlafen']);
    expect(moodsOf(['entspannend'])).toEqual(['ruhig', 'schlafen']);
  });

  it('ohne Wirkung keine Stimmung', () => {
    expect(moodsOf([])).toEqual([]);
  });
});

describe('parseMood', () => {
  it('nimmt nur bekannte Werte', () => {
    expect(parseMood('fokus')).toBe('fokus');
    expect(parseMood(['schlafen'])).toBe('schlafen');
    expect(parseMood('nachts')).toBeNull();
    expect(parseMood(undefined)).toBeNull();
  });
});

describe('daySlot', () => {
  const at = (h: number) => new Date(2026, 10, 2, h, 30);
  it('teilt den Tag in fuenf Abschnitte', () => {
    expect(daySlot(at(4))).toBe('night');
    expect(daySlot(at(5))).toBe('morning');
    expect(daySlot(at(12))).toBe('midday');
    expect(daySlot(at(15))).toBe('afternoon');
    expect(daySlot(at(19))).toBe('evening');
    expect(daySlot(at(23))).toBe('night');
  });
});

describe('sessionKind', () => {
  it('erkennt Video, Audio und Box an den vorhandenen Spalten', () => {
    expect(sessionKind({ playback_mode: 'timer', video_external_id: null })).toBe('box');
    expect(sessionKind({ playback_mode: 'audio_only', video_external_id: null })).toBe('audio');
    expect(sessionKind({ playback_mode: 'audio_guided', video_external_id: null })).toBe('audio');
    expect(sessionKind({ playback_mode: 'timer', video_external_id: '123' })).toBe('video');
  });
});

describe('suggestFor', () => {
  const list = [
    { id: 'wach', effects: ['aktivierend' as const], kind: 'box' as const },
    { id: 'aufnahme', effects: ['entspannend' as const], kind: 'audio' as const },
    { id: 'schlaf', effects: ['entspannend' as const], kind: 'box' as const },
  ];
  const kind = (s: (typeof list)[number]) => s.kind;

  it('nimmt die erste passende Box-Session', () => {
    expect(suggestFor(list, new Date(2026, 10, 2, 7), kind)?.id).toBe('wach');
    expect(suggestFor(list, new Date(2026, 10, 2, 23), kind)?.id).toBe('schlaf');
  });

  it('schlaegt nichts vor, wenn nichts passt', () => {
    expect(suggestFor(list, new Date(2026, 10, 2, 12), kind)).toBeNull();
  });
});

describe('Atemform', () => {
  const box = [
    { kind: 'inhale' as const, seconds: 4 },
    { kind: 'hold_in' as const, seconds: 4 },
    { kind: 'exhale' as const, seconds: 4 },
    { kind: 'hold_out' as const, seconds: 4 },
  ];

  it('zeichnet Ein steigend, Halten waagrecht, Aus fallend', () => {
    expect(profilePath(box, { width: 72, height: 40, padX: 4, padY: 8 })).toBe(
      'M4.0 32.0 L20.0 8.0 L36.0 8.0 L52.0 32.0 L68.0 32.0',
    );
  });

  it('liefert fuer den Lotus Zielwert und Dauer je Phase', () => {
    expect(profileKeyframes(box)).toEqual([
      { to: 1, ms: 4000 },
      { to: 1, ms: 4000 },
      { to: 0, ms: 4000 },
      { to: 0, ms: 4000 },
    ]);
  });

  it('ohne Phasen keine Kurve', () => {
    expect(profilePath([], { width: 72, height: 40, padX: 4, padY: 8 })).toBe('');
  });
});
