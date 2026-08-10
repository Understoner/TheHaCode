import { describe, expect, it } from 'vitest';

import { hasLegalPlaceholder } from './legalPlaceholder';

describe('hasLegalPlaceholder', () => {
  it('erkennt einen Platzhalter', () => {
    expect(hasLegalPlaceholder(['Michael', '[[TODO: Anschrift]]'])).toBe(true);
  });

  it('erkennt vollständig ausgefüllten Text nicht als Platzhalter', () => {
    expect(hasLegalPlaceholder(['Michael Untersteiner', 'Musterstraße 1, 1010 Wien'])).toBe(false);
  });

  it('liefert false für eine leere Liste', () => {
    expect(hasLegalPlaceholder([])).toBe(false);
  });
});
