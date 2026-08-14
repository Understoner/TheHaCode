import type { ViewProps } from 'react-native';

import { MOBILE_NAV_BREAKPOINT, MOBILE_TAB_BAR_SAFE_HEIGHT } from '@/design/navigation';

// Warum es diese Datei gibt
// -------------------------
// V1 wird statisch exportiert (SAD §2.5): jede Seite wird zur Bauzeit einmal
// gerendert und im Browser nur noch hydriert. useWindowDimensions() kennt zur
// Bauzeit keine Fensterbreite und liefert 0 - der Export enthielt deshalb
// IMMER die Mobilfassung. Auf einem Desktop baute React daraus etwas anderes
// als im ausgelieferten HTML stand, verwarf den kompletten Baum und rendert
// neu (React-Fehler #418, einmal pro Seitenaufruf). Der statische Export war
// auf Desktop damit wirkungslos.
//
// Ein Breakpoint in JavaScript kann das nicht loesen - die Breite ist zur
// Bauzeit schlicht nicht bekannt. CSS kann es: Media Queries wertet der
// Browser beim ersten Parsen aus, ohne JavaScript und ohne zweiten Render.
// Server und Client liefern damit dasselbe Markup.
//
// react-native-web kennt keine Media Queries im StyleSheet. Der vorgesehene
// Ausweg ist dataSet - daraus wird ein data-Attribut, das die Regeln unten
// ansprechen koennen. (NativeWind, das laut Stack-Tabelle spaeter kommt,
// brauecht diesen Umweg nicht mehr; bis dahin ist das hier der Ersatz und
// bewusst auf eine Datei und sechs Namen begrenzt.)

export type ResponsiveTarget =
  // Die beiden Navigationsfassungen stehen jetzt beide im HTML, CSS blendet
  // die jeweils unpassende aus.
  | 'nav-desktop'
  | 'nav-mobile'
  // Reserviert den Platz fuer die fixe Tab-Leiste - nur auf dem Handy noetig.
  | 'page-root'
  // Kartenraster: mobil eine Karte pro Reihe, ab dem Breakpoint feste Breite
  // statt flexGrow, damit eine einzelne Karte nicht auf volle Breite gezogen
  // wird (solange weniger als RECENT_ITEMS_COUNT Eintraege existieren).
  | 'news-grid'
  | 'courses-grid'
  | 'team-grid';

// Nur die Mindestbreiten unterscheiden sich - Teamkarten sind schmaler, weil
// sie neben dem 96px-Portrait weniger Fliesstext tragen.
const GRID_MIN_WIDTH: Record<'news-grid' | 'courses-grid' | 'team-grid', number> = {
  'news-grid': 280,
  'courses-grid': 280,
  'team-grid': 260,
};

// RNs Style-Typen sind nur fuer Nativ gedacht und fuehren dataSet nicht,
// obwohl react-native-web es unterstuetzt. Der Cast steht deshalb genau
// einmal hier statt an jeder Verwendungsstelle.
export function responsive(target: ResponsiveTarget): ViewProps {
  return { dataSet: { thc: target } } as unknown as ViewProps;
}

// Wird von src/app/+html.tsx in den <head> geschrieben. !important ist noetig,
// weil react-native-web seine Klassen nach diesem Block einhaengt und die
// Regeln sonst bei gleicher Spezifitaet verlieren.
export function responsiveCss(): string {
  const mobileMax = MOBILE_NAV_BREAKPOINT - 1;
  const gridRules = (Object.keys(GRID_MIN_WIDTH) as (keyof typeof GRID_MIN_WIDTH)[])
    .map(
      (target) =>
        `  [data-thc="${target}"] > * { flex-basis: 31% !important; min-width: ${GRID_MIN_WIDTH[target]}px !important; }`
    )
    .join('\n');

  return `
@media (max-width: ${mobileMax}px) {
  [data-thc="nav-desktop"] { display: none !important; }
  [data-thc="page-root"] { padding-bottom: ${MOBILE_TAB_BAR_SAFE_HEIGHT} !important; }
}
@media (min-width: ${MOBILE_NAV_BREAKPOINT}px) {
  [data-thc="nav-mobile"] { display: none !important; }
${gridRules}
}
`.trim();
}
