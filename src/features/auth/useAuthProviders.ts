import { useQuery } from '@tanstack/react-query';

import { OAUTH_PROVIDERS, type OAuthProvider } from '@/features/auth/providers';

// Welche Anbieter angeboten werden, entscheidet Supabase - nicht eine Variable
// in der App.
//
// Der erste Entwurf hatte dafuer EXPO_PUBLIC_AUTH_PROVIDERS. Das war ein
// zweiter Ort fuer dieselbe Wahrheit, und zwar einer, den man in drei
// Umgebungen (lokal, Staging, Live) getrennt richtig setzen muss. Vergisst man
// ihn nach dem Einschalten, bleibt der Knopf unsichtbar; setzt man ihn zu
// frueh, fuehrt er in eine Sackgasse (siehe oauth.ts).
//
// GoTrue beantwortet die Frage selbst, oeffentlich und ohne Anmeldung:
//
//   GET <SUPABASE_URL>/auth/v1/settings
//   -> { "external": { "google": true, "apple": false, "email": true, ... } }
//
// Damit erscheint ein Knopf genau dann, wenn er auch funktioniert - ohne dass
// jemand daran denken muss.
//
// Warum fetch und nicht der Supabase-Client: supabase-js v2 hat fuer diesen
// Endpunkt keine Methode (die gab es zuletzt in v1 als auth.api.getSettings).
// Es ist eine oeffentliche Konfigurationsauskunft, keine Datenabfrage - der
// enge connect-src der CSP deckt sie ab (src/app/+html.tsx).

type AuthSettings = { external?: Record<string, boolean> };

/** Die Abfrage selbst - als schlichte Funktion, damit sie ohne Renderer pruefbar ist. */
export async function fetchEnabledProviders(): Promise<OAuthProvider[]> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) throw new Error(`auth/v1/settings antwortete mit ${response.status}`);

  const settings = (await response.json()) as AuthSettings;
  // Die Reihenfolge kommt aus OAUTH_PROVIDERS und nicht aus der Antwort: die
  // Knoepfe sollen immer an derselben Stelle stehen. Der Filter sorgt
  // ausserdem dafuer, dass ein spaeter in Supabase eingeschalteter Anbieter,
  // fuer den es hier keine Beschriftung gibt, nicht ploetzlich auftaucht.
  return OAUTH_PROVIDERS.filter((provider) => settings.external?.[provider] === true);
}

export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: fetchEnabledProviders,
    // Das aendert sich nur, wenn jemand im Supabase-Dashboard etwas umstellt.
    // Einmal je Sitzung nachfragen genuegt.
    staleTime: Infinity,
    retry: 1,
  });
}
