// Die Content Security Policy des statischen Exports (eingebunden in
// src/app/+html.tsx). Hier und nicht dort, weil unter src/app jede Datei eine
// Route ist - ein Test daneben wuerde zur Seite.
//
// Ohne Header-Zugriff (statischer Export, kein eigener Serverprozess) ist das
// <meta>-CSP der einzige Weg, eine Content Security Policy auszuliefern.
// Bewusste Einschraenkungen dieses Wegs:
//   - 'unsafe-inline' bei script-src ist unvermeidbar: Expo legt den
//     Hydrations-Bootstrap als Inline-Modul ab, dessen Hash zur Bauzeit hier
//     nicht bekannt ist.
//   - frame-ancestors wirkt in <meta> nicht (nur als echter Header) und steht
//     deshalb nicht drin - es gehoert in die Hostinger-Konfiguration,
//     zusammen mit X-Content-Type-Options (docs/DEPLOYMENT.md §2).
// Wertvoll bleibt vor allem der enge connect-src/img-src: selbst bei einem
// eingeschleusten Skript gibt es kein Ziel, an das sich Daten abfliessen
// liessen, ausser der eigenen Domain und Supabase.
//
// ---------------------------------------------------------------------------
// WARUM connect-src AUCH wss:// NENNT (14.09.2026)
// ---------------------------------------------------------------------------
// Supabase Realtime spricht nicht https, sondern wss - auf demselben Host.
// Seit dem 14.08.2026 stand hier nur die https-Adresse, und seit dem 21.08.
// oeffnet useEntitlementSync nach jeder Anmeldung einen Realtime-Kanal. Chrome
// meldet die Verletzung nur in der Konsole. Safari lehnt den Websocket-Aufbau
// dagegen mit einer Ausnahme ab, realtime-js wirft sie weiter ("WebSocket not
// available"), und ohne Fehlergrenze raeumt React die ganze App ab: auf dem
// iPhone blieb nach dem Anmelden der Bildschirm leer.
//
// Dieselbe Herkunft, nur das Schema getauscht - kein Platzhalter, kein
// weiterer Host. Die Regel bleibt so eng wie vorher.

/** https://x.supabase.co -> [https://x.supabase.co, wss://x.supabase.co]. Leer bei ungueltiger Adresse. */
export function supabaseOrigins(url: string | undefined): string[] {
  try {
    const origin = new URL(url ?? '').origin;
    if (!/^https?:\/\//.test(origin)) return [];
    return [origin, origin.replace(/^http/, 'ws')];
  } catch {
    return [];
  }
}

export function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  const [http, ws] = supabaseOrigins(supabaseUrl);
  const liste = (...teile: (string | undefined)[]) => teile.filter(Boolean).join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // Hintergrundmusik liegt unter public/musik/ und damit auf der eigenen
    // Domain. Ausdruecklich genannt, damit die Regel beim Lesen sichtbar ist -
    // ueber default-src waere sie ohnehin erlaubt.
    "media-src 'self'",
    liste('img-src', "'self'", 'data:', 'blob:', http),
    liste('connect-src', "'self'", http, ws),
    'upgrade-insecure-requests',
  ].join('; ');
}
