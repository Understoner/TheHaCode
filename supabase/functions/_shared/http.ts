// CORS und Antworten - einmal fuer alle Edge Functions.
//
// HERKUNFT: NUR DIE EIGENE DOMAIN (30.10.2026, Security-Scan)
// ------------------------------------------------------------
// Bis dahin stand hier ohne gesetzte Liste "*", mit der Begruendung, dass der
// Zugangstoken schuetzt und nicht die Herkunft. Das stimmt weiterhin - aber
// "*" erlaubt jeder fremden Seite, die Funktionen aus dem Browser ueberhaupt
// anzusprechen, und es gibt keinen Grund, das zuzulassen. Jetzt gilt:
//
//   * ALLOWED_ORIGINS (Function Secret, durch Komma getrennt), falls gesetzt,
//   * dazu immer die Herkunft aus APP_URL - die Secret steht auf Staging und
//     Live ohnehin, der Checkout braucht sie - samt www-Variante,
//   * ist beides leer (lokal mit "supabase functions serve"), nur localhost.
//
// "*" gibt es nicht mehr. Ist die Konfiguration falsch, scheitert der Aufruf
// laut im Browser statt still offen zu stehen.
//
// delete-account nutzt seit 30.10.2026 ebenfalls diese Datei statt einer
// eigenen Kopie.

// Die Kopfzeilen, die der Browser im Preflight abfragt - und zwar ALLE, die
// supabase-js von sich aus mitschickt.
//
// HIER LAG EIN FEHLER, DER JEDEN AUFRUF AUS DEM BROWSER VERHINDERT HAT
// ---------------------------------------------------------------------
// Die Liste stand auf 'authorization, content-type'. supabase-js schickt aber
// bei jedem functions.invoke ausserdem 'apikey' und 'x-client-info'. Fragt der
// Browser im Preflight nach einer Kopfzeile, die nicht in
// Access-Control-Allow-Headers steht, bricht er ab - die eigentliche Anfrage
// geht nie los. In der App sah das aus wie ein Netzwerkfehler: "Daten konnten
// nicht geladen werden. Bitte pruefe deine Verbindung."
//
// Warum es so lange niemandem auffiel: geprueft wurde mit curl, und curl
// schickt keinen Preflight. Die Vitest-Tests wiederum reden nie mit dem Netz.
// Es gab also gruene Tests, gruene curl-Aufrufe - und eine Funktion, die aus
// dem Browser nie erreichbar war. Der Test in __tests__/http.test.ts haelt die
// Liste jetzt fest.
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

// Ein Preflight je Aufruf waere eine zusaetzliche Rundreise vor jeder Zahlung.
// Eine Stunde ist lang genug, um das zu ersparen, und kurz genug, dass eine
// Aenderung an dieser Datei zeitnah greift.
const MAX_AGE = '3600';

/** Wenn nichts konfiguriert ist: die Adressen der lokalen Entwicklung. */
const LOCAL_DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:8099', 'http://127.0.0.1:8081'];

/** Die erlaubten Herkuenfte aus ALLOWED_ORIGINS und APP_URL - rein, testbar. */
export function resolveAllowedOrigins(list: string | undefined, appUrl: string | undefined): string[] {
  const origins = new Set(
    (list ?? '')
      .split(',')
      .map((value) => value.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );
  try {
    if (appUrl) {
      const { origin, protocol, host } = new URL(appUrl);
      origins.add(origin);
      // Wer die Seite mit oder ohne www aufruft, soll gleich bedient werden.
      origins.add(`${protocol}//${host.startsWith('www.') ? host.slice(4) : `www.${host}`}`);
    }
  } catch {
    // Eine kaputte APP_URL faellt auf die Liste bzw. localhost zurueck.
  }
  return origins.size > 0 ? [...origins] : LOCAL_DEV_ORIGINS;
}

const ALLOWED_ORIGINS = resolveAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('APP_URL'));

/**
 * Die CORS-Kopfzeilen fuer eine Anfrage. Eine erlaubte Herkunft wird
 * zurueckgespiegelt; jede andere bekommt die erste erlaubte - der Browser
 * lehnt die Antwort dann ab.
 */
export function corsHeaders(origin: string | null, allowed: string[] = ALLOWED_ORIGINS): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': MAX_AGE,
    Vary: 'Origin',
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

export function preflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });
  }
  return null;
}
