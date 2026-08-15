// Konto endgueltig loeschen.
//
// WARUM ES DIESE FUNKTION GIBT
// ----------------------------
// Supabase bietet kein Loeschen des eigenen Kontos vom Client aus, und das ist
// richtig so: auth.users gehoert Supabase und ist nur ueber die Admin-API
// schreibbar, die den service_role-Schluessel verlangt. Der darf laut
// CLAUDE.md ausschliesslich in den Supabase Function Secrets leben - nie im
// Client-Bundle, nie in hPanel, nie in einer lokalen .env. Deshalb hier, und
// nur hier.
//
// ACHTUNG BEI AENDERUNGEN: das ist eine der Stellen, an denen ein Fehler still
// Daten preisgibt (CLAUDE.md, Aufgabenteilung). Die beiden Clients unten sind
// bewusst getrennt:
//
//   userClient  - traegt NUR den mitgeschickten Zugangstoken und den
//                 oeffentlichen anon-Schluessel. Er beantwortet die einzige
//                 Frage, die zaehlt: wer ruft hier eigentlich an?
//   adminClient - traegt service_role und loescht. Er bekommt IMMER die ID
//                 aus der Antwort des userClient, niemals eine ID aus dem
//                 Anfragekoerper. Sonst koennte jeder Angemeldete jedes
//                 fremde Konto loeschen.
//
// Alles Fachliche verschwindet ueber "on delete cascade" auf auth.users mit
// (Migration 0001, geprueft in supabase/tests/001_foundation.test.sql).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  // Ohne gesetzte Liste steht hier "*", und das ist hier vertretbar: was diese
  // Funktion schuetzt, ist nicht die Herkunft der Anfrage, sondern der
  // Zugangstoken. Eine fremde Seite kommt an den gar nicht heran - er liegt im
  // Speicher unserer eigenen Domain. Ohne Token gibt es unten 401, und mehr
  // wuerde eine Herkunftsliste auch nicht verhindern. Sie laesst sich ueber
  // ALLOWED_ORIGINS trotzdem enger ziehen; eine falsch gesetzte Liste macht
  // dann allerdings das Loeschen kaputt, ohne dass es jemand merkt.
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

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: 'not_configured' }, 500, origin);
  }

  // 1. Wer ruft an? Die Antwort kommt von Supabase, nicht aus der Anfrage.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401, origin);

  // 2. Loeschen - mit genau der ID aus Schritt 1.
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('deleteUser fehlgeschlagen', deleteError.message);
    return json({ error: 'delete_failed' }, 500, origin);
  }

  return json({ deleted: true }, 200, origin);
});
