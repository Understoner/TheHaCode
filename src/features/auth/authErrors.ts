// Supabase-Fehler in einen Text uebersetzen, den man ohne Technikkenntnis
// versteht und aus dem hervorgeht, was jetzt zu tun ist (CLAUDE.md:
// "Fehlermeldungen deutsch, ohne Technikjargon, immer mit Handlungsoption").
//
// Die Zuordnung laeuft ueber error.code und nicht ueber error.message: der
// Code ist Teil der Supabase-Schnittstelle, der englische Meldungstext nicht -
// er aendert sich zwischen Versionen. Nur wo es keinen Code gibt (Netzfehler
// aus fetch), bleibt der Blick auf die Meldung.

export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'emailTaken'
  | 'weakPassword'
  | 'samePassword'
  | 'rateLimited'
  | 'signupDisabled'
  | 'providerDisabled'
  | 'linkExpired'
  | 'cancelled'
  | 'network'
  | 'unknown';

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'emailTaken',
  email_exists: 'emailTaken',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  over_email_send_rate_limit: 'rateLimited',
  over_request_rate_limit: 'rateLimited',
  signup_disabled: 'signupDisabled',
  email_provider_disabled: 'signupDisabled',
  // Google/Apple sind im Projekt nicht eingeschaltet oder ohne Zugangsdaten
  // hinterlegt. Fuer den Nutzer ist das kein Fehler, den er beheben kann -
  // er soll auf den Weg mit E-Mail und Passwort ausweichen koennen.
  provider_disabled: 'providerDisabled',
  oauth_provider_not_supported: 'providerDisabled',
  // Der Link aus der E-Mail ist einmalig und laeuft ab (config.toml:
  // otp_expiry). Beides endet hier.
  otp_expired: 'linkExpired',
  flow_state_expired: 'linkExpired',
  flow_state_not_found: 'linkExpired',
  bad_code_verifier: 'linkExpired',
  // Der Nutzer hat bei Google oder Apple abgebrochen. Kein Fehler, nur ein
  // Hinweis - sonst steht er ratlos wieder auf der Anmeldeseite.
  access_denied: 'cancelled',
};

/** Der volle i18next-Schluessel zu einem Fehler aus supabase.auth.*. */
export function authErrorMessageKey(error: unknown): string {
  return `errors:auth.${authErrorKey(error)}`;
}

/**
 * Fehler von Google, Apple oder aus einem abgelaufenen E-Mail-Link kommen
 * nicht als Antwort auf einen Aufruf zurueck, sondern stehen in der Adresse,
 * auf die zurueckgesprungen wird - je nach Ablauf als Query oder als
 * Fragment. Ohne diese Auswertung landet der Nutzer wortlos wieder auf der
 * Anmeldeseite und weiss nicht, warum nichts passiert ist.
 *
 * Liefert null, wenn in der Adresse gar kein Fehler steht.
 */
export function urlErrorMessageKey(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('error_code') ?? fragment.get('error_code');
  const error = url.searchParams.get('error') ?? fragment.get('error');
  if (!code && !error) return null;

  // error_code ist der genauere Wert; error ist der grobe Sammelbegriff
  // ("access_denied", "server_error") und springt nur ein, wenn es keinen gibt.
  return `errors:auth.${authErrorKey({ code: code ?? error })}`;
}

export function authErrorKey(error: unknown): AuthErrorKey {
  if (typeof error !== 'object' || error === null) return 'unknown';

  const { code, status, message } = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };

  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code];

  // 429 ohne Code kommt vom Rate Limiter vor der eigentlichen Auth-Schicht.
  if (status === 429) return 'rateLimited';

  // Kommt gar keine Antwort zurueck, setzt supabase-js status auf 0 und reicht
  // die fetch-Meldung durch. Das ist kein Anmeldefehler, sondern ein
  // Verbindungsfehler - und braucht deshalb einen anderen Hinweis.
  if (status === 0) return 'network';
  if (typeof message === 'string' && /failed to fetch|network|load failed/i.test(message)) {
    return 'network';
  }

  return 'unknown';
}
