import { describe, expect, it } from 'vitest';

import { clientIp, guestKey } from '../guest-limit.ts';

describe('clientIp', () => {
  it('nimmt die Adresse, die Cloudflare setzt', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  // Die erste Adresse in x-forwarded-for kann der Aufrufer frei waehlen.
  it('nimmt aus x-forwarded-for die letzte, nicht die erste Adresse', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('liefert null, wenn keine Adresse mitkommt', () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe('guestKey', () => {
  it('ist fuer dieselbe Adresse stabil und verraet sie nicht', async () => {
    const a = await guestKey('geheim', '203.0.113.7');
    expect(a).toBe(await guestKey('geheim', '203.0.113.7'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203');
  });

  it('haengt vom Schluessel ab - ohne ihn laesst sich nichts zuruckrechnen', async () => {
    expect(await guestKey('geheim', '203.0.113.7')).not.toBe(await guestKey('anders', '203.0.113.7'));
  });
});
