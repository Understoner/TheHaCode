// Geraete-Anbindung Oura und Garmin (0053) - alles, was sich ohne Netz
// pruefen laesst: Antworten der Anbieter in Tageswerte uebersetzen, Adressen
// bauen und pruefen, Schluessel ver- und entschluesseln.
//
// NUR TAGESWERTE
// --------------
// Abgeholt werden Tageszusammenfassungen, keine Verlaeufe. Wo ein Anbieter
// nur Einzelwerte liefert (Garmin: Body Battery, Atemfrequenz im Schlaf),
// wird hier sofort zum Tagesdurchschnitt verdichtet - gespeichert wird nur er.
//
// Die Feldnamen stammen aus den Dokumentationen von Oura API v2 und Garmin
// Health API (Stand 11/2026). Fehlt ein Feld, entfaellt der Wert, statt den
// Abgleich abzubrechen.

export type WearableProvider = 'oura' | 'garmin';

export type WearableMetric =
  | 'steps'
  | 'floors'
  | 'intensity_minutes'
  | 'sleep_hours'
  | 'sleep_score'
  | 'resting_hr'
  | 'body_battery'
  | 'stress_level'
  | 'stress_minutes'
  | 'respiration'
  | 'weight';

export type DayValue = { metric: WearableMetric; day: string; value: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function push(out: DayValue[], metric: WearableMetric, day: unknown, value: number | null) {
  if (typeof day !== 'string' || !DAY.test(day) || value === null || value < 0) return;
  out.push({ metric, day, value: Math.round(value * 100) / 100 });
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Werte eines Garmin-"timeOffset…"-Objekts; negative heissen "nicht gemessen". */
function offsetValues(map: unknown): number[] {
  if (!map || typeof map !== 'object') return [];
  return Object.values(map as Record<string, unknown>)
    .map(num)
    .filter((v): v is number => v !== null && v >= 0);
}

// ===================================================================
// Oura API v2
// ===================================================================

export type OuraActivity = {
  day?: string;
  steps?: number;
  high_activity_time?: number;
  medium_activity_time?: number;
};
export type OuraDailySleep = { day?: string; score?: number | null };
export type OuraSleepPeriod = {
  day?: string;
  type?: string;
  total_sleep_duration?: number | null;
  average_breath?: number | null;
  lowest_heart_rate?: number | null;
};
export type OuraStress = { day?: string; stress_high?: number | null };

export type OuraCollections = {
  activity: OuraActivity[];
  dailySleep: OuraDailySleep[];
  sleep: OuraSleepPeriod[];
  stress: OuraStress[];
};

/**
 * Oura in Tageswerte. Intensitaetsminuten wie bei Garmin gezaehlt: maessig
 * einfach, intensiv doppelt (WHO-Lesart, Garmin "Intensitaetsminuten").
 * Schlaf: die Hauptschlafphasen des Tages (long_sleep); Ruhepuls und
 * Atemfrequenz aus der laengsten davon.
 */
export function ouraToDays(c: OuraCollections): DayValue[] {
  const out: DayValue[] = [];

  for (const a of c.activity) {
    push(out, 'steps', a.day, num(a.steps));
    const medium = num(a.medium_activity_time);
    const high = num(a.high_activity_time);
    if (medium !== null || high !== null) {
      push(out, 'intensity_minutes', a.day, ((medium ?? 0) + 2 * (high ?? 0)) / 60);
    }
  }

  for (const s of c.dailySleep) push(out, 'sleep_score', s.day, num(s.score));

  const byDay = new Map<string, OuraSleepPeriod[]>();
  for (const p of c.sleep) {
    if (typeof p.day !== 'string') continue;
    if (p.type !== 'long_sleep' && p.type !== 'sleep') continue;
    byDay.set(p.day, [...(byDay.get(p.day) ?? []), p]);
  }
  for (const [day, periods] of byDay) {
    const main = periods.filter((p) => p.type === 'long_sleep');
    const counted = main.length > 0 ? main : periods;
    const seconds = counted.map((p) => num(p.total_sleep_duration) ?? 0).reduce((a, b) => a + b, 0);
    if (seconds > 0) push(out, 'sleep_hours', day, seconds / 3600);
    const longest = [...counted].sort(
      (a, b) => (num(b.total_sleep_duration) ?? 0) - (num(a.total_sleep_duration) ?? 0),
    )[0];
    push(out, 'resting_hr', day, num(longest?.lowest_heart_rate));
    push(out, 'respiration', day, num(longest?.average_breath));
  }

  for (const s of c.stress) {
    const high = num(s.stress_high);
    push(out, 'stress_minutes', s.day, high === null ? null : high / 60);
  }

  return out;
}

// ===================================================================
// Garmin Health API
// ===================================================================

export type GarminDaily = {
  calendarDate?: string;
  steps?: number;
  floorsClimbed?: number;
  moderateIntensityDurationInSeconds?: number;
  vigorousIntensityDurationInSeconds?: number;
  restingHeartRateInBeatsPerMinute?: number;
  averageStressLevel?: number;
};
export type GarminSleep = {
  calendarDate?: string;
  durationInSeconds?: number;
  deepSleepDurationInSeconds?: number;
  lightSleepDurationInSeconds?: number;
  remSleepInSeconds?: number;
  awakeDurationInSeconds?: number;
  overallSleepScore?: { value?: number } | null;
  timeOffsetSleepRespiration?: Record<string, number>;
};
export type GarminStressDetail = {
  calendarDate?: string;
  timeOffsetBodyBatteryValues?: Record<string, number>;
  timeOffsetStressLevelValues?: Record<string, number>;
};

/** Body Composition: Index-Waage oder Eingabe in Garmin Connect (0054). */
export type GarminBodyComp = {
  measurementTimeInSeconds?: number;
  measurementTimeOffsetInSeconds?: number;
  weightInGrams?: number;
};

export type GarminSummaryType = 'dailies' | 'sleeps' | 'stressDetails' | 'bodyComps';

export const GARMIN_SUMMARY_TYPES: readonly GarminSummaryType[] = ['dailies', 'sleeps', 'stressDetails', 'bodyComps'];

export function garminDailiesToDays(items: GarminDaily[]): DayValue[] {
  const out: DayValue[] = [];
  for (const d of items) {
    push(out, 'steps', d.calendarDate, num(d.steps));
    push(out, 'floors', d.calendarDate, num(d.floorsClimbed));
    const moderate = num(d.moderateIntensityDurationInSeconds);
    const vigorous = num(d.vigorousIntensityDurationInSeconds);
    if (moderate !== null || vigorous !== null) {
      push(out, 'intensity_minutes', d.calendarDate, ((moderate ?? 0) + 2 * (vigorous ?? 0)) / 60);
    }
    push(out, 'resting_hr', d.calendarDate, num(d.restingHeartRateInBeatsPerMinute));
    // -1 heisst bei Garmin "zu wenig Daten".
    push(out, 'stress_level', d.calendarDate, num(d.averageStressLevel));
  }
  return out;
}

export function garminSleepsToDays(items: GarminSleep[]): DayValue[] {
  const out: DayValue[] = [];
  for (const s of items) {
    const phases = [s.deepSleepDurationInSeconds, s.lightSleepDurationInSeconds, s.remSleepInSeconds]
      .map(num)
      .filter((v): v is number => v !== null);
    const duration = num(s.durationInSeconds);
    const seconds =
      phases.length > 0
        ? phases.reduce((a, b) => a + b, 0)
        : duration === null
          ? null
          : duration - (num(s.awakeDurationInSeconds) ?? 0);
    if (seconds !== null && seconds > 0) push(out, 'sleep_hours', s.calendarDate, seconds / 3600);
    push(out, 'sleep_score', s.calendarDate, num(s.overallSleepScore?.value));
    push(out, 'respiration', s.calendarDate, mean(offsetValues(s.timeOffsetSleepRespiration)));
  }
  return out;
}

export function garminStressToDays(items: GarminStressDetail[]): DayValue[] {
  const out: DayValue[] = [];
  for (const s of items) {
    push(out, 'body_battery', s.calendarDate, mean(offsetValues(s.timeOffsetBodyBatteryValues)));
  }
  return out;
}

/**
 * Gewicht in kg. Body Compositions tragen kein calendarDate: der Tag ergibt
 * sich aus Messzeit plus Zeitzonen-Versatz der Person. Mehrere Messungen an
 * einem Tag - die letzte zaehlt.
 */
export function garminBodyCompsToDays(items: GarminBodyComp[]): DayValue[] {
  const sorted = [...items].sort(
    (a, b) => (num(a.measurementTimeInSeconds) ?? 0) - (num(b.measurementTimeInSeconds) ?? 0),
  );
  const out: DayValue[] = [];
  for (const b of sorted) {
    const at = num(b.measurementTimeInSeconds);
    const grams = num(b.weightInGrams);
    if (at === null || grams === null || grams <= 0) continue;
    const day = new Date((at + (num(b.measurementTimeOffsetInSeconds) ?? 0)) * 1000).toISOString().slice(0, 10);
    push(out, 'weight', day, grams / 1000);
  }
  return dedupeDays(out);
}

export function garminToDays(type: GarminSummaryType, items: unknown[]): DayValue[] {
  if (type === 'dailies') return garminDailiesToDays(items as GarminDaily[]);
  if (type === 'sleeps') return garminSleepsToDays(items as GarminSleep[]);
  if (type === 'bodyComps') return garminBodyCompsToDays(items as GarminBodyComp[]);
  return garminStressToDays(items as GarminStressDetail[]);
}

/**
 * Garmin schickt im Ping eine Adresse, unter der die Daten abzuholen sind.
 * Abgeholt wird nur bei Garmin selbst - sonst koennte ein gefaelschter Ping
 * die Funktion mit dem Schluessel der Person zu einer fremden Adresse
 * schicken.
 */
export function isGarminCallback(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'apis.garmin.com' && u.pathname.startsWith('/wellness-api/rest/');
  } catch {
    return false;
  }
}

/**
 * Eine Benachrichtigung von Garmin aufteilen (Push, seit 07.11.2026).
 *
 * - Ping (Enterprise): der Eintrag hat eine callbackURL - die Daten werden
 *   dort abgeholt. Auch eine ungueltige callbackURL bleibt ein Ping und wird
 *   damit verworfen, nie als Daten gelesen.
 * - Push (Starter): der Eintrag IST die Tageszusammenfassung, mit userId.
 *
 * Push-Eintraege werden je Garmin-Nutzer gesammelt, damit pro Person nur
 * einmal gespeichert wird.
 */
export function splitGarminNotification(items: unknown): {
  pings: { userId: string; callbackURL: unknown }[];
  pushed: Map<string, unknown[]>;
} {
  const pings: { userId: string; callbackURL: unknown }[] = [];
  const pushed = new Map<string, unknown[]>();
  if (!Array.isArray(items)) return { pings, pushed };
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const userId = (item as { userId?: unknown }).userId;
    if (typeof userId !== 'string' || userId.length === 0) continue;
    if ('callbackURL' in item) {
      pings.push({ userId, callbackURL: (item as { callbackURL?: unknown }).callbackURL });
    } else {
      pushed.set(userId, [...(pushed.get(userId) ?? []), item]);
    }
  }
  return { pings, pushed };
}

// ===================================================================
// Mehrere Tage zusammenfassen
// ===================================================================

/** Doppelte Tage (etwa zwei Garmin-Pings) - der spaetere gewinnt. */
export function dedupeDays(values: DayValue[]): DayValue[] {
  const map = new Map<string, DayValue>();
  for (const v of values) map.set(`${v.metric}|${v.day}`, v);
  return [...map.values()];
}

// ===================================================================
// OAuth
// ===================================================================

export const OURA = {
  authorize: 'https://cloud.ouraring.com/oauth/authorize',
  token: 'https://api.ouraring.com/oauth/token',
  revoke: 'https://api.ouraring.com/oauth/revoke',
  api: 'https://api.ouraring.com/v2/usercollection',
  scope: 'daily',
} as const;

export const GARMIN = {
  authorize: 'https://connect.garmin.com/oauth2Confirm',
  token: 'https://diauth.garmin.com/di-oauth2-service/oauth/token',
  api: 'https://apis.garmin.com/wellness-api/rest',
} as const;

export function authorizeUrl(
  provider: WearableProvider,
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  if (provider === 'oura') {
    params.set('scope', OURA.scope);
    return `${OURA.authorize}?${params}`;
  }
  // Garmin verlangt PKCE (OAuth 2.0 mit S256).
  params.set('code_challenge', codeChallenge);
  params.set('code_challenge_method', 'S256');
  return `${GARMIN.authorize}?${params}`;
}

/** Der Ruecksprung in die App - dort wird der Code mit der Sitzung eingeloest. */
export function redirectUriFor(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/habit-tracker/geraete`;
}

// ===================================================================
// Verschluesselung (AES-GCM, Web Crypto - Deno und Node gleich)
// ===================================================================

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** WEARABLE_TOKEN_KEY: 32 Byte, Base64 (`openssl rand -base64 32`). */
export async function importKey(base64: string): Promise<CryptoKey> {
  const raw = fromB64Url(base64.trim());
  if (raw.length !== 32) throw new Error('WEARABLE_TOKEN_KEY muss 32 Byte lang sein');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/**
 * Verschluesselt mit Zweck ("token", "state") als zusaetzlichen Daten: ein
 * Schluessel aus der Datenbank laesst sich so nicht als state ausgeben.
 */
export async function seal(key: CryptoKey, purpose: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(purpose) },
    key,
    data,
  );
  return `v1.${toB64Url(iv)}.${toB64Url(new Uint8Array(cipher))}`;
}

export async function unseal(key: CryptoKey, purpose: string, sealed: string): Promise<string> {
  const [version, iv, cipher] = sealed.split('.');
  if (version !== 'v1' || !iv || !cipher) throw new Error('unbekanntes Format');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64Url(iv), additionalData: new TextEncoder().encode(purpose) },
    key,
    fromB64Url(cipher),
  );
  return new TextDecoder().decode(plain);
}

/** PKCE: zufaelliger Verifier und seine S256-Pruefsumme. */
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = toB64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: toB64Url(new Uint8Array(digest)) };
}

export type OAuthState = { userId: string; provider: WearableProvider; verifier: string; expiresAt: number };

export const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Der state ist verschluesselt statt in einer Tabelle gespeichert: er traegt
 * Person, Anbieter, PKCE-Verifier und Ablauf. Eingeloest wird er nur von
 * derselben angemeldeten Person (siehe index.ts, "finish") - so kann niemand
 * einen fremden Ring an sein eigenes Konto haengen oder umgekehrt.
 */
export async function sealState(key: CryptoKey, state: OAuthState): Promise<string> {
  return seal(key, 'state', JSON.stringify(state));
}

export async function openState(key: CryptoKey, sealed: string, now = Date.now()): Promise<OAuthState | null> {
  try {
    const s = JSON.parse(await unseal(key, 'state', sealed)) as OAuthState;
    if (typeof s.userId !== 'string' || (s.provider !== 'oura' && s.provider !== 'garmin')) return null;
    if (typeof s.expiresAt !== 'number' || s.expiresAt < now) return null;
    return s;
  } catch {
    return null;
  }
}
