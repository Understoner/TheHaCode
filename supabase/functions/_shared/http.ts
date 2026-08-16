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

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (ALLOWED_ORIGINS.length === 0) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
  }

  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
