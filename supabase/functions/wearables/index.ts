// Geraete-Anbindung Oura und Garmin (0053, 07.11.2026, nur Testsystem) -
// die Wege der App. Alle verlangen eine angemeldete Person:
//
//   POST {action:"start", provider}               -> Adresse zum Anbieter
//   POST {action:"finish", code, state}           -> Code einloesen, verbinden
//   POST {action:"sync"}                          -> Oura abholen
//   POST {action:"disconnect", provider}          -> widerrufen und loeschen
//
// Garmin liefert seine Daten selbst, ueber die Funktion wearables-garmin.
//
// ACHTUNG BEI AENDERUNGEN: service_role (CLAUDE.md, Aufgabenteilung). Wie in
// delete-account bekommt der adminClient IMMER die ID aus getUser(), nie eine
// aus dem Anfragekoerper.
//
// AUS, SOLANGE NICHT AUSDRUECKLICH AN
// -----------------------------------
// Ohne Function Secret WEARABLES_ENABLED=true antwortet die Funktion mit 404.
// Gesetzt ist es nur auf Staging (docs/WEARABLES.md). Live bleibt so aus,
// auch wenn die Funktion mit einer Befoerderung dorthin kommt.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.118.0';

import { corsHeaders, json } from '../_shared/http.ts';
import {
  authorizeUrl,
  GARMIN,
  importKey,
  OURA,
  openState,
  pkcePair,
  redirectUriFor,
  sealState,
  STATE_TTL_MS,
  unseal,
  type WearableProvider,
} from '../_shared/wearables.ts';
import {
  clientFor,
  env,
  isProvider,
  requestGarminBackfill,
  requestToken,
  secretFor,
  storeTokens,
  syncOura,
  WearableError,
} from '../_shared/wearables-server.ts';

// ===================================================================
// Die Wege der App
// ===================================================================

async function start(userClient: SupabaseClient, key: CryptoKey, userId: string, provider: WearableProvider) {
  const client = clientFor(provider);
  const appUrl = env('APP_URL');
  if (!client.id || !client.secret || !appUrl) throw new WearableError('not_configured');

  // Ohne Einwilligung nach Art. 9 gar nicht erst zum Anbieter schicken -
  // speichern wuerde die Datenbank ohnehin nichts (save_wearable_days).
  const { data: consent } = await userClient.rpc('has_consent', { p_kind: 'health_data' });
  if (consent !== true) throw new WearableError('consent_required');

  const { verifier, challenge } = await pkcePair();
  const state = await sealState(key, { userId, provider, verifier, expiresAt: Date.now() + STATE_TTL_MS });
  return { url: authorizeUrl(provider, client.id, redirectUriFor(appUrl), state, challenge) };
}

async function finish(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  key: CryptoKey,
  userId: string,
  body: { code?: unknown; state?: unknown },
) {
  if (typeof body.code !== 'string' || typeof body.state !== 'string' || body.code.length > 2000) {
    throw new WearableError('bad_request');
  }
  // Der Anbieter steht im state - die App muss ihn sich nicht merken.
  const state = await openState(key, body.state);
  // Der state muss von DIESER Person stammen. Sonst koennte jemand einen
  // Link mit seinem state verschicken und die Daten eines fremden Rings in
  // das eigene Konto leiten.
  if (!state || state.userId !== userId) {
    throw new WearableError('state_invalid');
  }

  const { data: consent } = await userClient.rpc('has_consent', { p_kind: 'health_data' });
  if (consent !== true) throw new WearableError('consent_required');

  const provider = state.provider;
  const tokens = await requestToken(provider, {
    grant_type: 'authorization_code',
    code: body.code,
    redirect_uri: redirectUriFor(env('APP_URL')),
    ...(provider === 'garmin' ? { code_verifier: state.verifier } : {}),
  });

  let providerUserId: string | null = null;
  if (provider === 'garmin') {
    const response = await fetch(`${GARMIN.api}/user/id`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const idBody = response.ok ? ((await response.json()) as { userId?: string }) : {};
    if (typeof idBody.userId !== 'string') throw new WearableError('garmin_user');
    providerUserId = idBody.userId;
  }

  const { data: connection, error } = await admin
    .from('wearable_connections')
    .upsert({ user_id: userId, provider, last_error: null, deleted_at: null }, { onConflict: 'user_id,provider' })
    .select('id')
    .single();
  if (error || !connection) throw new WearableError('store_failed');

  await storeTokens(
    admin,
    key,
    { connection_id: connection.id as string, user_id: userId, provider, provider_user_id: providerUserId },
    tokens,
  );

  if (provider === 'oura') await syncOura(admin, key, userId, true);
  else await requestGarminBackfill(tokens.access_token);

  return { connected: provider };
}

async function sync(admin: SupabaseClient, key: CryptoKey, userId: string) {
  const { data } = await admin
    .from('wearable_connections')
    .select('provider, last_synced_at')
    .eq('user_id', userId)
    .eq('provider', 'oura')
    .maybeSingle();
  if (data) await syncOura(admin, key, userId, data.last_synced_at === null);
  return { synced: true };
}

async function disconnect(admin: SupabaseClient, key: CryptoKey, userId: string, provider: unknown) {
  if (!isProvider(provider)) throw new WearableError('bad_request');
  const secret = await secretFor(admin, userId, provider);
  if (secret) {
    // Beim Anbieter widerrufen - nach bestem Bemuehen: scheitert das, sind
    // die Schluessel hier trotzdem weg und nicht mehr benutzbar.
    try {
      const token = await unseal(key, 'token', secret.access_token);
      if (provider === 'oura') {
        await fetch(`${OURA.revoke}?${new URLSearchParams({ access_token: token })}`);
      } else {
        await fetch(`${GARMIN.api}/user/registration`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error('Widerruf beim Anbieter', provider, error instanceof Error ? error.message : error);
    }
  }
  const { error } = await admin.rpc('remove_wearable', { p_user_id: userId, p_provider: provider });
  if (error) throw new WearableError('remove_failed');
  return { disconnected: provider };
}

// ===================================================================
// Einstieg
// ===================================================================

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  if (env('WEARABLES_ENABLED') !== 'true') {
    return new Response('not found', { status: 404 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const url = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const tokenKey = env('WEARABLE_TOKEN_KEY');
  if (!url || !anonKey || !serviceRoleKey || !tokenKey) {
    return json({ error: 'not_configured' }, 500, origin);
  }

  const key = await importKey(tokenKey);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401, origin);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401, origin);
  const userId = data.user.id;

  let body: { action?: unknown; provider?: unknown; code?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400, origin);
  }

  try {
    switch (body.action) {
      case 'start':
        if (!isProvider(body.provider)) return json({ error: 'bad_request' }, 400, origin);
        return json(await start(userClient, key, userId, body.provider), 200, origin);
      case 'finish':
        return json(await finish(userClient, admin, key, userId, body), 200, origin);
      case 'sync':
        return json(await sync(admin, key, userId), 200, origin);
      case 'disconnect':
        return json(await disconnect(admin, key, userId, body.provider), 200, origin);
      default:
        return json({ error: 'bad_request' }, 400, origin);
    }
  } catch (caught) {
    const code = caught instanceof WearableError ? caught.message : 'failed';
    console.error('wearables', body.action, code);
    const status = code === 'consent_required' || code === 'state_invalid' ? 403 : code === 'bad_request' ? 400 : 502;
    // Nur der Code geht an die App; sie zeigt dazu eine deutsche Meldung.
    return json({ error: code }, status, origin);
  }
});
