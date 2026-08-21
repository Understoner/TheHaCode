import { describe, expect, it } from 'vitest';

// http.ts liest schon beim Laden Deno.env - unter Vitest gibt es kein Deno.
// Der Stub steht deshalb im Modulrumpf und nicht in beforeAll: Hooks laufen
// erst nach dem Import, die erste Zeile von http.ts waere da laengst
// gescheitert.
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => undefined } };

const { corsHeaders, preflight } = await import('../http.ts');

// Was supabase-js bei jedem functions.invoke von sich aus mitschickt. Fehlt
// eine davon in Access-Control-Allow-Headers, bricht der Browser den Preflight
// ab und die eigentliche Anfrage geht nie los.
//
// Genau das ist am 21.08.2026 passiert: die Liste stand auf
// 'authorization, content-type', und damit war KEINE Edge Function aus dem
// Browser erreichbar - Preisabfrage, Checkout, Kundenportal, Kontoloeschung.
// Aufgefallen ist es erst beim Test auf dev, weil curl keinen Preflight
// schickt und die uebrigen Tests nie mit dem Netz reden.
const VOM_CLIENT_GESCHICKT = ['authorization', 'x-client-info', 'apikey', 'content-type'];

describe('corsHeaders', () => {
  it('erlaubt jede Kopfzeile, die supabase-js mitschickt', () => {
    const erlaubt = corsHeaders(null)['Access-Control-Allow-Headers']
      .split(',')
      .map((name) => name.trim().toLowerCase());

    for (const name of VOM_CLIENT_GESCHICKT) {
      expect(erlaubt, `${name} fehlt in Access-Control-Allow-Headers`).toContain(name);
    }
  });

  it('erlaubt POST und OPTIONS', () => {
    expect(corsHeaders(null)['Access-Control-Allow-Methods']).toMatch(/POST/);
    expect(corsHeaders(null)['Access-Control-Allow-Methods']).toMatch(/OPTIONS/);
  });

  it('erspart den Preflight vor jedem Aufruf', () => {
    expect(Number(corsHeaders(null)['Access-Control-Max-Age'])).toBeGreaterThan(0);
  });

  // Ohne ALLOWED_ORIGINS steht dort '*' - das ist die bewusste Vorgabe
  // (siehe Kopf von http.ts: was schuetzt, ist der Token, nicht die Herkunft).
  it('laesst ohne Herkunftsliste jede Herkunft zu', () => {
    expect(corsHeaders('https://irgendwo.example')['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('preflight', () => {
  it('beantwortet OPTIONS mit 204 und den CORS-Kopfzeilen', () => {
    const antwort = preflight(new Request('https://x.test', { method: 'OPTIONS' }));

    expect(antwort?.status).toBe(204);
    expect(antwort?.headers.get('Access-Control-Allow-Headers')).toMatch(/apikey/);
  });

  it('laesst alles andere durch', () => {
    expect(preflight(new Request('https://x.test', { method: 'POST' }))).toBeNull();
  });
});
