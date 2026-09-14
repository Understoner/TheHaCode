import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, supabaseOrigins } from './contentSecurityPolicy';

/** Die Quellen einer Direktive, ohne ihren Namen. */
function direktive(csp: string, name: string): string[] {
  const eintrag = csp.split('; ').find((teil) => teil.startsWith(`${name} `)) ?? '';
  return eintrag.split(' ').slice(1);
}

describe('contentSecurityPolicy', () => {
  // Ohne wss:// lehnt Safari den Realtime-Kanal mit einer Ausnahme ab, und die
  // App bleibt nach dem Anmelden leer (14.09.2026, am iPhone).
  it('erlaubt Supabase Realtime ueber wss auf demselben Host', () => {
    const csp = contentSecurityPolicy('https://tlwmypyqtgsahdscfyaj.supabase.co');

    expect(direktive(csp, 'connect-src')).toEqual([
      "'self'",
      'https://tlwmypyqtgsahdscfyaj.supabase.co',
      'wss://tlwmypyqtgsahdscfyaj.supabase.co',
    ]);
  });

  it('nimmt lokal ws statt wss', () => {
    expect(supabaseOrigins('http://127.0.0.1:54321')).toEqual([
      'http://127.0.0.1:54321',
      'ws://127.0.0.1:54321',
    ]);
  });

  // Die Regel soll so eng bleiben wie vorher: kein Platzhalter, kein fremder
  // Host, und Bilder weiterhin nur ueber https.
  it('oeffnet nichts ueber den eigenen Supabase-Host hinaus', () => {
    const csp = contentSecurityPolicy('https://abc.supabase.co/rest/v1');

    expect(csp).not.toContain('*');
    expect(direktive(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:', 'https://abc.supabase.co']);
    expect(direktive(csp, 'connect-src')).toHaveLength(3);
  });

  // Entscheidung vom 14.09.2026: mit data: spielt der Wachhalte-Ton aus
  // audioSession.ts, und iOS unterbricht dafuer die Musik aus der App des
  // Nutzers. Dieser Test faellt auf, wenn jemand data: wieder zulaesst - dann
  // bitte die Abwaegung im Kommentar an media-src neu fuehren.
  it('laesst Audio als data-Adresse bewusst NICHT zu', () => {
    const csp = contentSecurityPolicy('https://abc.supabase.co');

    expect(direktive(csp, 'media-src')).toEqual(["'self'"]);
  });

  it('bleibt ohne gueltige Adresse bei der eigenen Domain', () => {
    for (const adresse of [undefined, '', 'kein-url']) {
      const csp = contentSecurityPolicy(adresse);
      expect(direktive(csp, 'connect-src')).toEqual(["'self'"]);
      expect(csp).not.toContain('undefined');
    }
  });
});
