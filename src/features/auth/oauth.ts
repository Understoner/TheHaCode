import type { Provider } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Anmeldung ueber Google und Apple.
//
// Auch das kommt vollstaendig aus Supabase (CLAUDE.md): der Client baut nur
// die Adresse und springt hin, den ganzen Rest - Zustimmung beim Anbieter,
// Rueckgabe, Kontoverknuepfung - macht Supabase. Es gibt hier deshalb keine
// eigene Token-Behandlung und keine eigene auth_provider-Spalte; welche
// Anbieter an einem Konto haengen, steht in auth.identities.
//
// WARUM DIE SCHALTFLAECHEN AN EINER VARIABLE HAENGEN
// -------------------------------------------------
// Ist ein Anbieter in Supabase nicht eingeschaltet, springt der Nutzer NICHT
// mit einem Fehler zurueck - der /authorize-Endpunkt antwortet stattdessen mit
// nacktem JSON:
//
//   {"code":400,"error_code":"validation_failed",
//    "msg":"Unsupported provider: provider is not enabled"}
//
// Der Nutzer steht dann auf einer fremden Adresse vor einer Zeile Technik und
// kommt nur ueber die Zurueck-Taste wieder heraus. Aus der App heraus laesst
// sich das nicht abfangen, weil der Browser die Seite laengst verlassen hat.
//
// Deshalb entscheidet eine Variable, welche Anbieter ueberhaupt angeboten
// werden - und ihr Standard ist "keiner". Ein fehlender Knopf ist aergerlich,
// ein Knopf in eine Sackgasse ist schlimmer.
//
// EINSCHALTEN, in dieser Reihenfolge:
//   1. Zugangsdaten beim Anbieter anlegen (Google Cloud OAuth-Client bzw.
//      Apple Services ID + Key).
//   2. [auth.external.google] / [auth.external.apple] in
//      supabase/config.toml auf enabled = true, Geheimnisse per env().
//      Auf Staging/Live im Supabase-Dashboard des Projekts.
//   3. Ruecksprungadresse (<origin>/konto) in additional_redirect_urls
//      erlauben.
//   4. EXPO_PUBLIC_AUTH_PROVIDERS=google,apple setzen.
//
// Erst danach sind die Schaltflaechen sichtbar - und dann funktionieren sie.

export const OAUTH_PROVIDERS = ['google', 'apple'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Die tatsaechlich angebotenen Anbieter. Bewusst bei jedem Aufruf gelesen und
 * nicht einmal beim Laden des Moduls - so laesst sich der Zustand im Test
 * setzen, ohne die Reihenfolge der Importe zu kennen.
 */
export function enabledProviders(): OAuthProvider[] {
  const raw = process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? '';
  const genannt = raw.split(',').map((value) => value.trim().toLowerCase());
  return OAUTH_PROVIDERS.filter((provider) => genannt.includes(provider));
}

/**
 * Wohin der Anbieter zurueckspringt. Bewusst aus window.location abgeleitet
 * und nicht aus einer Variable: die App laeuft auf drei Adressen (lokal,
 * Testsystem, Livesystem), und eine falsch gesetzte Variable waere hier ein
 * Fehler, der erst beim Zurueckspringen auffaellt.
 */
export function oauthRedirectTo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/konto`;
}

export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: unknown }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: { redirectTo: oauthRedirectTo() },
  });
  return { error };
}
