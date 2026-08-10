import { describe, expect, it } from 'vitest';

import { estimateReadingMinutes } from './readingTime';

describe('estimateReadingMinutes', () => {
  it('rundet auf mindestens 1 Minute, auch bei kurzen Texten', () => {
    expect(estimateReadingMinutes('Kurzer Text.')).toBe(1);
  });

  it('rechnet mit 200 Woertern pro Minute', () => {
    const text = Array.from({ length: 400 }, () => 'wort').join(' ');
    expect(estimateReadingMinutes(text)).toBe(2);
  });

  it('ignoriert mehrfache Leerzeichen und Zeilenumbrueche', () => {
    const text = 'eins   zwei\n\ndrei\tvier';
    expect(estimateReadingMinutes(text)).toBe(1);
  });
});
