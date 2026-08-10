import { describe, expect, it } from 'vitest';

import { colors } from './tokens';

describe('tokens', () => {
  it('definiert Hintergrund- und Textfarbe', () => {
    expect(colors.background).toBeTruthy();
    expect(colors.ink900).toBeTruthy();
    expect(colors.ink700).toBeTruthy();
  });
});
