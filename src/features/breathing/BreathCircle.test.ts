import { describe, expect, it } from 'vitest';

import de from '@/i18n/locales/de/common.json';

import { INNER_DIAMETER_MIN, LABEL_MAX_HEIGHT, LABEL_MAX_WIDTH } from './BreathCircle';

// Die Beschriftung im Kreis wird nicht mitskaliert. Ob sie am Ende in den Ring
// passt, entscheidet sich an zwei Stellen, die weit auseinanderliegen: an der
// Groesse des Kastens (BreathCircle.tsx) und an der Laenge der Worte
// (common.json). Wie breit ein Wort in Pixeln wird, kann jsdom nicht messen -
// die Zeichenzahl ist die Stellvertretung dafuer.

const texte = de as Record<string, string>;

describe('BreathCircle - Beschriftung', () => {
  it('passt als Kasten in den kleinsten Ring', () => {
    const diagonale = Math.hypot(LABEL_MAX_WIDTH, LABEL_MAX_HEIGHT);
    expect(diagonale).toBeLessThanOrEqual(INNER_DIAMETER_MIN);
  });

  // "HALTE" und "PAUSE" sind in 26 px rund 90 px breit - ein sechster
  // Buchstabe liefe bei manchen Schriften schon an den Rand.
  it('haelt die Phasenworte bei hoechstens fuenf Buchstaben', () => {
    const phasen = Object.entries(texte).filter(
      ([key]) => key.startsWith('player.circle.') && !key.startsWith('player.circle.route.'),
    );

    expect(phasen.length).toBeGreaterThanOrEqual(6);
    for (const [key, wort] of phasen) {
      expect(wort.length, key).toBeLessThanOrEqual(5);
    }
  });

  // "LIPPENBREMSE" ist das laengste und in 11 px rund 90 px breit.
  it('haelt die Atemwege bei hoechstens zwoelf Buchstaben', () => {
    const wege = Object.entries(texte).filter(([key]) => key.startsWith('player.circle.route.'));

    expect(wege.map(([key]) => key).sort()).toEqual([
      'player.circle.route.mouth',
      'player.circle.route.nose',
      'player.circle.route.pursed_lips',
    ]);
    for (const [key, wort] of wege) {
      expect(wort.length, key).toBeLessThanOrEqual(12);
    }
  });
});
