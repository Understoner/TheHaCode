// Benachrichtigungen von Garmin (0053, nur Testsystem; Push seit 07.11.2026).
//
// Zwei Arten, je nach Zugangsstufe im Garmin Developer Program:
// - Push (Starter, kostenlos): die Tageszusammenfassungen stehen direkt im
//   Koerper und werden fuer bekannte Garmin-Nutzer-IDs gespeichert.
// - Ping (Enterprise): nur eine Abhol-Adresse; abgeholt wird mit dem Token
//   der Person bei apis.garmin.com (wearables-server.ts).
//
// Garmin schickt kein Supabase-JWT, deshalb verify_jwt = false (config.toml).
// Wer hier anruft, muss stattdessen den vereinbarten Schluessel in der
// Adresse tragen: ?key=<GARMIN_WEBHOOK_KEY> - so im Garmin-Portal eingetragen.
//
// ACHTUNG: Bei Push ist dieser Schluessel der einzige Schutz. Wer ihn kennt
// und eine Garmin-Nutzer-ID errät, kann Tageswerte fuer diese Person
// einschleusen (nur innerhalb der Wertgrenzen der Habits; manuelle Eintraege
// bleiben unberuehrt). Schluessel daher nie weitergeben; bei Verdacht neu
// erzeugen und im Garmin-Portal tauschen.

import { createClient } from 'jsr:@supabase/supabase-js@2.118.0';

import { importKey } from '../_shared/wearables.ts';
import { env, handleGarminPing } from '../_shared/wearables-server.ts';

/** Vergleich in konstanter Zeit - der Schluessel soll sich nicht erraten lassen. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (request) => {
  if (env('WEARABLES_ENABLED') !== 'true') return new Response('not found', { status: 404 });
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const expected = env('GARMIN_WEBHOOK_KEY');
  const given = new URL(request.url).searchParams.get('key') ?? '';
  if (expected.length < 24 || !sameKey(given, expected)) return new Response('forbidden', { status: 403 });

  const url = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const tokenKey = env('WEARABLE_TOKEN_KEY');
  if (!url || !serviceRoleKey || !tokenKey) return new Response('not configured', { status: 500 });

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    await handleGarminPing(admin, await importKey(tokenKey), body);
  } catch (error) {
    console.error('Garmin-Ping', error instanceof Error ? error.message : error);
  }
  // Garmin wiederholt bei Fehlern - ein kaputter Datensatz soll nicht endlos
  // zurueckkommen, er steht als last_error an der Verbindung.
  return new Response(null, { status: 200 });
});
