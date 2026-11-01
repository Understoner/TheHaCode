import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { responsiveCss } from '@/design/responsive';
import { DEFAULT_THEME, DESIGN_PREVIEW, palettes, themeCss } from '@/design/tokens';
import { contentSecurityPolicy } from '@/lib/contentSecurityPolicy';

// Die HTML-Huelle des statischen Exports, ausschliesslich zur Bauzeit
// gerendert (SAD §2.5). Hier steht, was fuer das gesamte Dokument gilt und
// was Expo sonst falsch vorbelegt - allen voran lang="en" auf einer
// deutschsprachigen Seite.
//
// Titel und Beschreibung stehen bewusst NICHT hier, sondern in _layout.tsx
// ueber expo-routers <Head>: Expo rendert ohnehin ein von react-helmet
// verwaltetes <title data-rh="true"> an den Anfang des <head>, und der Browser
// nimmt immer das erste - ein zweiter Titel an dieser Stelle bliebe wirkungslos.

// Die Content Security Policy steht mit Begruendung und Test in
// src/lib/contentSecurityPolicy.ts. Die Adresse wird HIER ausgelesen, und zwar
// als woertliches process.env.EXPO_PUBLIC_SUPABASE_URL: nur so setzt Expo den
// Wert zur Bauzeit ein.

const ICONS = DESIGN_PREVIEW ? '/icons/mondlicht' : '/icons';

export default function Root({ children }: PropsWithChildren) {
  return (
    // data-theme steht schon im ausgelieferten HTML: Mondlicht ist im
    // Testsystem die Grundeinstellung, theme-init.js schaltet nur fuer
    // jemanden um, der "Klar" gewaehlt hat.
    <html lang="de" data-theme={DESIGN_PREVIEW ? DEFAULT_THEME : undefined}>
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
        <meta
          httpEquiv="Content-Security-Policy"
          content={contentSecurityPolicy(process.env.EXPO_PUBLIC_SUPABASE_URL)}
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light" />

        {/* Auf dem Startbildschirm (SAD §11: die Seite soll sich ablegen
            lassen wie eine App, ohne eine zu sein).
            Die Bilder und das Manifest liegen unter public/ und werden vom
            statischen Export unveraendert nach dist/ kopiert; erzeugt hat sie
            scripts/write-app-icons.mjs aus den Tokens.

            ANDROID UND IOS GEHEN VERSCHIEDENE WEGE, deshalb steht beides da:
            Chrome liest das Manifest und nimmt die Icons daraus. Safari liest
            das Manifest NICHT fuer das Symbol auf dem Startbildschirm - es
            nimmt ausschliesslich apple-touch-icon. Fehlt die Zeile, macht iOS
            einen verkleinerten Bildschirmabzug der Seite daraus, und der ist
            unter einem Symbol nicht wiederzuerkennen. */}
        {/* Im Testsystem (01.11.2026) eigene Icons im Stil Mondlicht und ein
            eigenes Manifest - erzeugt vom selben Skript, siehe dort. */}
        <link rel="manifest" href={DESIGN_PREVIEW ? '/manifest-mondlicht.json' : '/manifest.json'} />
        <link rel="apple-touch-icon" href={`${ICONS}/apple-touch-icon.png`} />
        <link rel="icon" type="image/png" sizes="32x32" href={`${ICONS}/favicon-32.png`} />
        <link rel="icon" type="image/png" sizes="192x192" href={`${ICONS}/favicon-192.png`} />

        {/* Ohne die erste Zeile oeffnet iOS die abgelegte Seite in Safari
            statt in einem eigenen Fenster. Der Name darunter steht unter dem
            Symbol - ohne ihn nimmt iOS den <title>, und der traegt den Zusatz
            "— Atemtraining", der dort abgeschnitten wuerde. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Atemcode" />
        {/* "default" heisst dunkle Schrift auf hellem Grund - die Seite ist
            hell (color-scheme oben). */}
        {/* Im Testsystem ist die Seite dunkel (Mondlicht): helle Schrift in der Statusleiste. */}
        <meta name="apple-mobile-web-app-status-bar-style" content={DESIGN_PREVIEW ? 'black' : 'default'} />
        {/* Faerbt die Systemleiste in Android. Dieselbe Farbe wie im Manifest
            und wie die Seite selbst, damit es beim Starten keinen Farbsprung
            gibt - deshalb aus den Tokens und nicht als Literal. */}
        {/* Hex statt colors.background: im Testsystem ist das eine
            CSS-Variable, und die versteht das Meta-Tag nicht. */}
        <meta name="theme-color" content={palettes[DEFAULT_THEME].background} />

        {/* Darstellungen Klar/Mondlicht, nur im Testsystem (src/design/tokens.ts).
            Das Skript steht nach dem theme-color-Tag, weil es dieses umfaerbt,
            und vor dem Inhalt, damit nichts hell aufblitzt. */}
        {DESIGN_PREVIEW ? (
          <>
            <style id="thehacode-theme" dangerouslySetInnerHTML={{ __html: themeCss() }} />
            <script src="/theme-init.js" />
          </>
        ) : null}

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
