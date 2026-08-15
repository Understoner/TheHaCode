import type { Provider } from '@supabase/supabase-js';

import { OAUTH_PROVIDERS, type OAuthProvider } from '@/features/auth/providers';
import { supabase } from '@/lib/supabase';

export { OAUTH_PROVIDERS, type OAuthProvider };

// Anmeldung ueber Google und Apple.
//
// Auch das kommt vollstaendig aus Supabase (CLAUDE.md): der Client baut nur
// die Adresse und springt hin, den ganzen Rest - Zustimmung beim Anbieter,
// Rueckgabe, Kontoverknuepfung - macht Supabase. Es gibt hier deshalb keine
// eigene Token-Behandlung und keine eigene auth_provider-Spalte; welche
// Anbieter an einem Konto haengen, steht in auth.identities.
//
// WARUM DIE SCHALTFLAECHEN NICHT IMMER DA SIND
// ---------------------------------------------
// Ist ein Anbieter in Supabase nicht eingerichtet, springt der Nutzer NICHT
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
// Deshalb zeigt die App nur die Anbieter, die Supabase als eingeschaltet
// meldet (src/features/auth/useAuthProviders.ts). Ein Knopf erscheint genau
// dann, wenn er auch funktioniert.
//
// EINSCHALTEN, in dieser Reihenfolge:
//   1. Zugangsdaten beim Anbieter anlegen (Google Cloud OAuth-Client bzw.
//      Apple Services ID + Key). Rueckruf-Adresse ist immer
//      <SUPABASE_URL>/auth/v1/callback, nicht die der App.
//   2. [auth.external.google] / [auth.external.apple] in
//      supabase/config.toml auf enabled = true, Geheimnisse per env().
//      Auf Staging/Live im Supabase-Dashboard des Projekts.
//   3. Ruecksprungadresse (<origin>/konto) in additional_redirect_urls
//      erlauben.
//
// Schritt 4 gibt es nicht - die App merkt es von selbst.
//
// Ausfuehrlich mit allen Feldern: docs/AUTH-PROVIDER.md

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
