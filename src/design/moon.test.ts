import { describe, expect, it } from 'vitest';

import { moonPath } from './moon';

describe('moonPath', () => {
  it('zeichnet nichts bei Neumond und einen vollen Kreis bei Vollmond', () => {
    expect(moonPath(0, 10)).toBe('');
    expect(moonPath(1, 10)).toBe('M0 -10 A 10 10 0 1 1 0 10 A 10 10 0 1 1 0 -10 Z');
  });

  it('wechselt bei Halbmond die Bogenrichtung', () => {
    expect(moonPath(0.25, 10)).toContain('A 5.00 10 0 0 0 0 -10');
    expect(moonPath(0.75, 10)).toContain('A 5.00 10 0 0 1 0 -10');
  });
});
