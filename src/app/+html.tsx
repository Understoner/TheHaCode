import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { responsiveCss } from '@/design/responsive';

// Die HTML-Huelle des statischen Exports, ausschliesslich zur Bauzeit
// gerendert (SAD §2.5). Hier steht, was fuer das gesamte Dokument gilt und
// was Expo sonst falsch vorbelegt - allen voran lang="en" auf einer
// deutschsprachigen Seite.
//
// Titel und Beschreibung stehen bewusst NICHT hier, sondern in _layout.tsx
// ueber expo-routers <Head>: Expo rendert ohnehin ein von react-helmet
// verwaltetes <title data-rh="true"> an den Anfang des <head>, und der Browser
// nimmt immer das erste - ein zweiter Titel an dieser Stelle bliebe wirkungslos.

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
function supabaseOrigin(): string {
  try {
    return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
}

function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    `connect-src 'self' ${supabase}`.trim(),
    'upgrade-insecure-requests',
  ].join('; ');
}

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover ist die Voraussetzung dafuer, dass
            env(safe-area-inset-bottom) ueberhaupt einen Wert liefert - die
            fixe Tab-Leiste unten braucht ihn (src/design/navigation.ts). */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy()} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light" />

        {/* Die Breakpoints der Seite. Sie stehen als CSS und nicht als
            JavaScript im Dokument, damit der statische Export auf jeder
            Fenstergroesse dasselbe Markup ergibt - siehe die Begruendung in
            src/design/responsive.ts. */}
        <style id="thehacode-responsive" dangerouslySetInnerHTML={{ __html: responsiveCss() }} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
