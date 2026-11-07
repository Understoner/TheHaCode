// Geraete-Anbindung (0053): Schluessel, Abholen und Speichern - gemeinsam fuer
// die Funktionen "wearables" (Wege der App, mit JWT) und "wearables-garmin"
// (Benachrichtigung von Garmin, ohne JWT).
//
// ACHTUNG BEI AENDERUNGEN: service_role (CLAUDE.md, Aufgabenteilung).
// Geschrieben wird nur ueber save_wearable_days() und remove_wearable(); die
// pruefen Einwilligung und Verbindung in der Datenbank. Die user_id kommt
// immer aus getUser() oder aus der gespeicherten Garmin-Zuordnung, nie aus
// einem Anfragekoerper.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2.118.0';

import {
  dedupeDays,
  GARMIN,
  GARMIN_SUMMARY_TYPES,
  garminPersonalPath,
  garminPersonalToDays,
  garminPersonalToken,
  garminToDays,
  GARMIN_PERSONAL,
  shapeOf,
  type GarminPersonalEndpoint,
  isGarminCallback,
  splitGarminNotification,
  OURA,
  ouraToDays,
  seal,
  unseal,
  type DayValue,
  type GarminSummaryType,
  type OuraCollections,
  type WearableProvider,
} from './wearables.ts';

export const env = (name: string) => Deno.env.get(name) ?? '';

/** Beim ersten Abgleich so weit zurueck, danach nur die letzten Tage. */
export const FIRST_SYNC_DAYS = 30;
export const SYNC_DAYS = 7;

export type Secret = {
  connection_id: string;
  user_id: string;
  provider: WearableProvider;
  provider_user_id: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

export class WearableError extends Error {}

export function isProvider(value: unknown): value is WearableProvider {
  return value === 'oura' || value === 'garmin';
}

export function clientFor(provider: WearableProvider) {
  return provider === 'oura'
    ? { id: env('OURA_CLIENT_ID'), secret: env('OURA_CLIENT_SECRET'), token: OURA.token }
    : { id: env('GARMIN_CLIENT_ID'), secret: env('GARMIN_CLIENT_SECRET'), token: GARMIN.token };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  return isoDay(new Date(Date.now() - days * 86400_000));
}

// ===================================================================
// Schluessel
// ===================================================================

export async function requestToken(provider: WearableProvider, params: Record<string, string>): Promise<TokenResponse> {
  const client = clientFor(provider);
  const response = await fetch(client.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: client.id, client_secret: client.secret }),
  });
  if (!response.ok) throw new WearableError(`token_${response.status}`);
  const body = (await response.json()) as TokenResponse;
  if (typeof body.access_token !== 'string') throw new WearableError('token_invalid');
  return body;
}

export async function storeTokens(
  admin: SupabaseClient,
  key: CryptoKey,
  secret: Pick<Secret, 'connection_id' | 'user_id' | 'provider' | 'provider_user_id'>,
  tokens: TokenResponse,
  previousRefresh: string | null = null,
) {
  const { error } = await admin.from('wearable_secrets').upsert({
    connection_id: secret.connection_id,
    user_id: secret.user_id,
    provider: secret.provider,
    provider_user_id: secret.provider_user_id,
    access_token: await seal(key, 'token', tokens.access_token),
    // Oura gibt bei jeder Erneuerung einen NEUEN refresh_token aus, der alte
    // gilt dann nicht mehr - also immer den neuesten speichern.
    refresh_token: tokens.refresh_token
      ? await seal(key, 'token', tokens.refresh_token)
      : previousRefresh,
    expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
  });
  if (error) throw new WearableError('store_failed');
}

/** Gueltiger Zugangsschluessel - bei Bedarf vorher erneuert. */
export async function accessToken(admin: SupabaseClient, key: CryptoKey, secret: Secret): Promise<string> {
  const expiresSoon = secret.expires_at !== null && new Date(secret.expires_at).getTime() < Date.now() + 5 * 60_000;
  if (!expiresSoon) return unseal(key, 'token', secret.access_token);
  if (!secret.refresh_token) throw new WearableError('token_expired');

  const tokens = await requestToken(secret.provider, {
    grant_type: 'refresh_token',
    refresh_token: await unseal(key, 'token', secret.refresh_token),
  });
  await storeTokens(admin, key, secret, tokens, secret.refresh_token);
  return tokens.access_token;
}

export async function secretFor(admin: SupabaseClient, userId: string, provider: WearableProvider): Promise<Secret | null> {
  const { data } = await admin
    .from('wearable_secrets')
    .select('connection_id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  return (data as Secret | null) ?? null;
}

export async function markError(admin: SupabaseClient, userId: string, provider: WearableProvider, code: string) {
  await admin
    .from('wearable_connections')
    .update({ last_error: code.slice(0, 80) })
    .eq('user_id', userId)
    .eq('provider', provider);
}

export async function save(admin: SupabaseClient, userId: string, provider: WearableProvider, values: DayValue[]) {
  const { error } = await admin.rpc('save_wearable_days', {
    p_user_id: userId,
    p_provider: provider,
    p_values: dedupeDays(values),
  });
  if (error) {
    console.error('save_wearable_days', error.message);
    throw new WearableError('save_failed');
  }
}

// ===================================================================
// Oura: abholen
// ===================================================================

async function ouraCollection<T>(token: string, name: string, from: string, to: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = null;
  // Fuer 30 Tage reicht eine Seite; next_token nur zur Sicherheit, begrenzt.
  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({ start_date: from, end_date: to });
    if (next) params.set('next_token', next);
    const response = await fetch(`${OURA.api}/${name}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) throw new WearableError('token_expired');
    // 403 heisst bei Oura meist: keine aktive Mitgliedschaft.
    if (response.status === 403) throw new WearableError('oura_membership');
    if (!response.ok) throw new WearableError(`oura_${response.status}`);
    const body = (await response.json()) as { data?: T[]; next_token?: string | null };
    out.push(...(body.data ?? []));
    next = body.next_token ?? null;
    if (!next) break;
  }
  return out;
}

export async function syncOura(admin: SupabaseClient, key: CryptoKey, userId: string, firstSync: boolean) {
  const secret = await secretFor(admin, userId, 'oura');
  if (!secret) return;
  try {
    const token = await accessToken(admin, key, secret);
    const from = daysAgo(firstSync ? FIRST_SYNC_DAYS : SYNC_DAYS);
    // end_date morgen: Oura zaehlt den Endtag je nach Sammlung nicht mit.
    const to = daysAgo(-1);
    const [activity, dailySleep, sleep, stress] = await Promise.all([
      ouraCollection<OuraCollections['activity'][number]>(token, 'daily_activity', from, to),
      ouraCollection<OuraCollections['dailySleep'][number]>(token, 'daily_sleep', from, to),
      ouraCollection<OuraCollections['sleep'][number]>(token, 'sleep', from, to),
      ouraCollection<OuraCollections['stress'][number]>(token, 'daily_stress', from, to),
    ]);
    await save(admin, userId, 'oura', ouraToDays({ activity, dailySleep, sleep, stress }));
  } catch (error) {
    await markError(admin, userId, 'oura', error instanceof WearableError ? error.message : 'sync_failed');
    throw error;
  }
}

// ===================================================================
// Garmin: Benachrichtigung, Daten abholen, Rueckschau anfordern
// ===================================================================

/**
 * Garmin meldet neue Daten mit einer Abhol-Adresse ("Ping/Pull"). Abgeholt
 * wird mit dem Schluessel der Person - die Daten kommen also nachweislich von
 * Garmin, auch wenn der Ping selbst nicht signiert ist.
 */
export async function handleGarminPing(admin: SupabaseClient, key: CryptoKey, body: Record<string, unknown>) {
  // Abgemeldet oder Berechtigung entzogen: Verbindung und Tageswerte loeschen.
  for (const type of ['deregistrations', 'userPermissionsChange'] as const) {
    const items = Array.isArray(body[type]) ? (body[type] as { userId?: string; permissions?: string[] }[]) : [];
    for (const item of items) {
      if (type === 'userPermissionsChange' && item.permissions?.includes('HEALTH_EXPORT')) continue;
      const owner = await garminOwner(admin, item.userId);
      if (owner) await admin.rpc('remove_wearable', { p_user_id: owner.user_id, p_provider: 'garmin' });
    }
  }

  for (const type of GARMIN_SUMMARY_TYPES) {
    const { pings, pushed } = splitGarminNotification(body[type]);

    // Push (Starter): die Zusammenfassungen stehen schon im Koerper.
    for (const [garminUserId, summaries] of pushed) {
      const owner = await garminOwner(admin, garminUserId);
      if (!owner) continue;
      try {
        await save(admin, owner.user_id, 'garmin', garminToDays(type as GarminSummaryType, summaries));
      } catch (error) {
        await markError(admin, owner.user_id, 'garmin', error instanceof WearableError ? error.message : 'sync_failed');
      }
    }

    // Ping (Enterprise): bei Garmin abholen, mit dem Token der Person.
    for (const item of pings) {
      if (!isGarminCallback(item.callbackURL)) continue;
      const owner = await garminOwner(admin, item.userId);
      if (!owner) continue;
      try {
        const token = await accessToken(admin, key, owner);
        const response = await fetch(item.callbackURL, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new WearableError(`garmin_${response.status}`);
        const summaries = (await response.json()) as unknown[];
        if (Array.isArray(summaries)) {
          await save(admin, owner.user_id, 'garmin', garminToDays(type as GarminSummaryType, summaries));
        }
      } catch (error) {
        await markError(admin, owner.user_id, 'garmin', error instanceof WearableError ? error.message : 'sync_failed');
      }
    }
  }
}

export async function garminOwner(admin: SupabaseClient, garminUserId: unknown): Promise<Secret | null> {
  if (typeof garminUserId !== 'string' || garminUserId.length === 0) return null;
  const { data } = await admin
    .from('wearable_secrets')
    .select('connection_id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at')
    .eq('provider', 'garmin')
    .eq('provider_user_id', garminUserId)
    .maybeSingle();
  return (data as Secret | null) ?? null;
}

/**
 * Nach dem Verbinden: Garmin um die letzten 30 Tage bitten. Nur mit
 * Enterprise-Zugang - beim Starter-Zugang (keine Rueckschau) lehnt Garmin
 * ab, das bleibt folgenlos: Werte kommen dann ab dem Tag des Verbindens.
 */
export async function requestGarminBackfill(token: string) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - FIRST_SYNC_DAYS * 86400;
  await Promise.all(
    GARMIN_SUMMARY_TYPES.map((type) =>
      fetch(`${GARMIN.api}/backfill/${type}?summaryStartTimeInSeconds=${start}&summaryEndTimeInSeconds=${end}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null),
    ),
  );
}

// ===================================================================
// Garmin mit persoenlichem Schluessel: einmaliger Import (07.11.2026)
// ===================================================================

const PERSONAL_ENDPOINTS: GarminPersonalEndpoint[] = ['steps', 'stress', 'summaries', 'sleeps', 'bodyBattery', 'weight'];
/** Garmin nennt keine Hoechstspanne je Abfrage - lieber in kleinen Stuecken. */
const PERSONAL_CHUNK_DAYS = 10;

/**
 * Laedt mit dem persoenlichen Garmin-Schluessel der Person die letzten 30
 * Tage. Der Schluessel wird NICHT gespeichert und nie geloggt: er tauscht
 * sich gegen ein Zugriffstoken (24 h), das nur fuer diese Anfrage lebt.
 *
 * Gedacht fuer Tests und den ersten Import. Garmin schreibt zur Personal API:
 * "not intended for commercial applications serving multiple end users" -
 * vor einem Livegang mit Garmin klaeren (docs/WEARABLES.md).
 */
export async function importGarminPersonal(admin: SupabaseClient, userId: string, apiKey: string) {
  const tokenResponse = await fetch(GARMIN_PERSONAL.token, {
    method: 'POST',
    // Garmin antwortet mit dem Token als reinem Text und lehnt
    // "Accept: application/json" mit 406 ab (geprueft 07.11.2026).
    headers: { Authorization: `ApiKey ${apiKey}` },
  });
  if (tokenResponse.status === 401 || tokenResponse.status === 403) throw new WearableError('garmin_key_invalid');
  if (!tokenResponse.ok) throw new WearableError(`garmin_token_${tokenResponse.status}`);
  const text = await tokenResponse.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // reine Zeichenkette - garminPersonalToken prueft, ob es ein JWT ist
  }
  const token = garminPersonalToken(parsed);
  if (!token) throw new WearableError('garmin_key_invalid');

  // Zeitraum in Stuecken: [heute-29 .. heute]
  const chunks: { from: string; to: string }[] = [];
  for (let end = 0; end < FIRST_SYNC_DAYS; end += PERSONAL_CHUNK_DAYS) {
    chunks.push({ from: daysAgo(Math.min(end + PERSONAL_CHUNK_DAYS, FIRST_SYNC_DAYS) - 1), to: daysAgo(end) });
  }

  const raw: Partial<Record<GarminPersonalEndpoint, unknown[]>> = {};
  const failed: string[] = [];
  await Promise.all(
    PERSONAL_ENDPOINTS.map(async (endpoint) => {
      const parts: unknown[] = [];
      for (const { from, to } of chunks) {
        try {
          const response = await fetch(`${GARMIN_PERSONAL.api}${garminPersonalPath(endpoint, from, to)}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (!response.ok) {
            failed.push(`${endpoint}:${response.status}`);
            continue;
          }
          parts.push(await response.json());
        } catch {
          failed.push(`${endpoint}:fetch`);
        }
      }
      raw[endpoint] = parts;
    }),
  );

  // Fuer das Nachschaerfen der Feldnamen: nur Namen, nie Werte.
  console.log(
    'garmin-personal shapes',
    JSON.stringify(Object.fromEntries(PERSONAL_ENDPOINTS.map((e) => [e, shapeOf(raw[e]?.[0])]))),
    'failed',
    failed.join(','),
  );

  const values = garminPersonalToDays(raw);
  if (values.length === 0) {
    throw new WearableError(failed.length >= PERSONAL_ENDPOINTS.length * chunks.length ? 'garmin_personal_failed' : 'garmin_personal_empty');
  }

  // save_wearable_days verlangt eine Verbindung. Ohne OAuth-Zugang steht
  // sie ohne Schluessel da; "Trennen" loescht die Werte wie gewohnt.
  const { error } = await admin
    .from('wearable_connections')
    .upsert({ user_id: userId, provider: 'garmin', last_error: null, deleted_at: null }, { onConflict: 'user_id,provider' });
  if (error) throw new WearableError('store_failed');

  await save(admin, userId, 'garmin', values);

  const counts: Record<string, number> = {};
  for (const v of values) counts[v.metric] = (counts[v.metric] ?? 0) + 1;
  return { imported: counts };
}
