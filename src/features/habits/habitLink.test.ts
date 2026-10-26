import { describe, expect, it } from 'vitest';

import { habitLinkTarget, isValidHabitLink, normalizeHabitLink } from './habitLink';

describe('isValidHabitLink', () => {
  it('nimmt App-Pfade und http(s) an', () => {
    expect(isValidHabitLink('/sessions/abc')).toBe(true);
    expect(isValidHabitLink('https://example.at/video')).toBe(true);
    expect(isValidHabitLink('http://example.at')).toBe(true);
  });

  it('lehnt alles ab, was Code ausfuehren oder fremd weiterleiten koennte', () => {
    expect(isValidHabitLink('javascript:alert(1)')).toBe(false);
    expect(isValidHabitLink('//fremd.example')).toBe(false);
    expect(isValidHabitLink('data:text/html,x')).toBe(false);
    expect(isValidHabitLink('sessions/abc')).toBe(false);
    expect(isValidHabitLink('/a b')).toBe(false);
  });
});

describe('normalizeHabitLink', () => {
  it('macht aus einer Adresse dieser App einen Pfad', () => {
    expect(
      normalizeHabitLink('https://app.example.at/sessions/abc?x=1', 'https://app.example.at'),
    ).toBe('/sessions/abc?x=1');
  });

  it('laesst fremde Adressen stehen und leert leere Eingaben', () => {
    expect(normalizeHabitLink(' https://video.example/x ', 'https://app.example.at')).toBe(
      'https://video.example/x',
    );
    expect(normalizeHabitLink('   ', 'https://app.example.at')).toBeNull();
  });
});

describe('habitLinkTarget', () => {
  it('erkennt Sessions in der App', () => {
    expect(habitLinkTarget('/sessions/abc')).toEqual({
      kind: 'app',
      href: '/sessions/abc',
      isSession: true,
    });
    expect(habitLinkTarget('/kurse')).toEqual({
      kind: 'app',
      href: '/kurse',
      isSession: false,
    });
  });

  it('oeffnet nur sichere Adressen nach draussen', () => {
    expect(habitLinkTarget('https://example.at')).toEqual({
      kind: 'external',
      href: 'https://example.at',
    });
    expect(habitLinkTarget('javascript:alert(1)')).toBeNull();
    expect(habitLinkTarget('mailto:a@b.at')).toBeNull();
    expect(habitLinkTarget(null)).toBeNull();
  });
});
