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
// bewusst auf eine Datei und wenige Namen begrenzt.)

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
  | 'team-grid'
  | 'sessions-grid'
  // Tagebuch und Habit-Auswahl (26.10.2026): dieselbe Kartenlogik wie die
  // Sessions, statt einer schmalen Spalte in der Mitte der Seite.
  | 'habits-grid'
  // Die Kontoseite: Abo, Einwilligungen, Daten und Loeschen stehen mobil
  // untereinander, ab dem Breakpoint zu zweit nebeneinander. Ohne das haengen
  // vier Bereiche in einer 420px-Spalte, waehrend rechts daneben die halbe
  // Seite leer bleibt.
  | 'konto-grid'
  // Die Habit-Karten im Tagebuch (30.10.2026): auf dem Handy ohne
  // Beschreibung, dafuer mit einem "i" rechts oben, das sie als Karte
  // oeffnet. Ab dem Breakpoint steht die Beschreibung wie bisher in der
  // Karte und das "i" faellt weg. Die beiden letzten Ziele schaffen auf dem
  // Handy Platz fuer das "i": der Text laeuft nicht darunter, und das
  // Bedienelement rueckt unter das "i" statt daneben.
  | 'habit-info'
  | 'habit-desc'
  | 'habit-text'
  | 'habit-control'
  // Die Symbolreihe neben einer Seitenueberschrift (HeaderIcon.tsx). Mit vier
  // Symbolen (Tagebuch) ragte sie bei 320 px ueber den Rand; unter 360 px
  // ruecken die Symbole deshalb enger zusammen (30.10.2026).
  | 'header-icons';

// Nur die Mindestbreiten unterscheiden sich. Teamkarten tragen seit dem
// Umbau auf die News-Anatomie (Bild oben ueber die volle Breite) dieselbe
// Struktur wie News und Kurse und deshalb auch dieselbe Mindestbreite -
// schmaler gestellt wuerde das quadratische Portrait unnoetig klein.
// Habit-Karten tragen Knoepfe und Eingabefelder und brauchen deshalb etwas
// mehr Breite als eine Session-Karte.
const GRID_MIN_WIDTH: Record<
  'news-grid' | 'courses-grid' | 'team-grid' | 'sessions-grid' | 'habits-grid',
  number
> = {
  'news-grid': 280,
  'courses-grid': 280,
  'team-grid': 280,
  'sessions-grid': 260,
  'habits-grid': 300,
};

// Die Kontoseite hat ihre eigene Regel: zwei Spalten statt drei. Die Bereiche
// tragen Fliesstext und Formularelemente, keine Vorschaubilder - bei einem
// Drittel Breite wuerde jede zweite Zeile umbrechen.
const KONTO_COLUMN_MIN_WIDTH = 340;

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
  [data-thc="habit-desc"] { display: none !important; }
  [data-thc="habit-text"] { padding-right: 28px !important; }
  [data-thc="habit-control"] { margin-top: 28px !important; }
}
@media (max-width: 359px) {
  [data-thc="header-icons"] { gap: 8px !important; }
}
@media (min-width: ${MOBILE_NAV_BREAKPOINT}px) {
  [data-thc="nav-mobile"] { display: none !important; }
  [data-thc="habit-info"] { display: none !important; }
${gridRules}
  [data-thc="konto-grid"] > * { flex-basis: 48% !important; min-width: ${KONTO_COLUMN_MIN_WIDTH}px !important; }
}
`.trim();
}
