// CORS und Antworten - einmal fuer alle Edge Functions.
//
// Die Ueberlegung zur Herkunftsliste stammt aus delete-account/index.ts und
// gilt hier unveraendert: was diese Funktionen schuetzt, ist nicht die Herkunft
// der Anfrage, sondern der Zugangstoken. Eine fremde Seite kommt an den gar
// nicht heran, er liegt im Speicher unserer eigenen Domain. Ohne Token gibt es
// 401, und mehr wuerde eine Herkunftsliste auch nicht verhindern - sie laesst
// sich ueber ALLOWED_ORIGINS trotzdem enger ziehen.
//
// delete-account bleibt bewusst bei seiner eigenen Kopie: die Funktion ist in
// Betrieb, hat keinen Test, und ein Umbau braechte hier kein Verhalten in
// Ordnung, das kaputt waere. Wer sie das naechste Mal ohnehin anfasst, kann
// sie mitnehmen.

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

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (ALLOWED_ORIGINS.length === 0) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': MAX_AGE,
    };
  }

  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
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
