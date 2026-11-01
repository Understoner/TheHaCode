// Einzige Quelle fuer Farbwerte (CLAUDE.md: keine Farbliterale in Komponenten).
// Ocean/Salbei-System, uebernommen aus ui/references/*.svg (10.08.2026).
// Kontrastregel bleibt bindend: Fliesstext ausschliesslich in den 700er-Toenen
// (>=4,5:1 auf background/surface). Die 500er sind reine Flaechenfarben.
//
// ZWEI DARSTELLUNGEN (01.11.2026, nur Testsystem)
// ------------------------------------------------
// "Klar" ist das bisherige Design. "Mondlicht" ist eine verspielte,
// spirituelle Alternative, waehlbar unter /einstellungen. Beide Paletten
// tragen dieselben Namen mit derselben Bedeutung - ink900 ist in beiden die
// Schrift fuer Ueberschriften, ocean700 die Flaeche, die Text in `surface`
// traegt. Deshalb funktioniert jede Komponente in beiden, ohne sie anzufassen.
//
// Im Testsystem sind `colors` und `radius` CSS-Variablen (var(--c-...)); die
// Werte setzt +html.tsx je nach <html data-theme>. Umschalten heisst, dieses
// Attribut zu aendern - kein Neuladen, kein Abgleich mit dem statisch
// gerenderten HTML. Im Livesystem bleiben es die festen Werte von "Klar",
// genau wie bisher: DESIGN_PREVIEW ist dort false (EXPO_PUBLIC_APP_ENV wird
// zur Bauzeit eingesetzt).
//
// Rueckbau: diesen Abschnitt, themeCss() und alles mit DESIGN_PREVIEW
// entfernen - der PR "Design Mondlicht" laesst sich als Ganzes reverten.

/** Alternative Darstellung und neue Startseite - nur im Testsystem. */
export const DESIGN_PREVIEW = process.env.EXPO_PUBLIC_APP_ENV === 'staging';

const klar = {
  // Seiten- und Flaechenfarben. Die Seite selbst ist getoent (nicht reines
  // Weiss), Karten/Inhalte sitzen als weisse surface darauf.
  background: '#EFF3F4',
  surface: '#FFFFFF',
  // Sehr helle Flaeche fuer ruhige Infoboxen (z. B. "Ueber mich").
  surfaceSubtle: '#FAFBFC',

  // Text. ink900 fuer Ueberschriften, ink700 fuer allen Fliess-/Metatext.
  ink900: '#16242B',
  ink700: '#5A6B75',
  // NICHT fuer Text - Kontrast unter 4,5:1. Nur fuer Icon-Striche/Deko.
  ink500: '#8C9AA3',

  // Ocean - Primaerfarbe. ocean700 ist die einzige Ocean-Flaeche, die Text
  // (auch weissen) traegt: ocean500 mit weisser Schrift lag bei ~3,4:1 -
  // unter der 4,5:1-Regel. ocean500 bleibt reine Flaechen-/Bildfarbe.
  ocean700: '#3B6C82',
  ocean800: '#2E5768',
  ocean500: '#5B93AC',
  oceanTint: '#F0F6F9',
  // Bildhintergrund/Platzhalterflaeche in Ocean-Familie (Cover-Bilder).
  oceanImageBg: '#DCE8F0',

  // Salbei - Sekundaerfarbe: zweiter Akzent (z. B. "Ausatmen", TEAM-Tags).
  // sage700 bewusst dunkler als die Referenz-Vorlage (#5F7F5B) - dort lag der
  // Kontrast auf Weiss nur bei ~4,5:1, das ist zu knapp fuer die 4,5:1-Regel.
  sage700: '#4F6B4C',
  sage500: '#87A582',
  sageTint: '#F2F6F1',

  // Trennlinien.
  line: '#E8EDF1',
  lineStrong: '#D3DCE3',
  // Fokusring / Umrandung fuer hervorgehobene Karten (z. B. Featured-Kurs).
  focusRing: '#B9D4E0',

  // Hinweisbanner (Staging, Rechtstext-Platzhalter) - unveraendert, da die
  // Referenzvorlagen dafuer keine eigene Farbe vorgeben.
  warningSurface: '#FDECC8',
  // Halbtransparente Flaeche fuer Kategorie-Pills ueber Cover-Bildern
  // (ui/references/05_news_mobile.svg, 06_news_desktop.svg).
  overlaySurface: 'rgba(255,255,255,0.9)',
  // Abgedunkelter Hintergrund hinter einer Ueberblendung (InfoButton): ink900
  // mit 45 Prozent. Dunkel genug, dass die Karte davor klar steht - hell
  // genug, dass man die Seite darunter noch erkennt.
  scrim: 'rgba(22,36,43,0.45)',
  // Destruktive Aktionen (z. B. "Block loeschen" im Konfigurator, spaeter).
  danger: '#B45A5A',

  // Akzente der Startseite (Mond, Ornamente). In "Klar" Ocean und Salbei.
  glow: '#5B93AC',
  blossom: '#87A582',
} as const;

export type ColorName = keyof typeof klar;
export type Palette = Record<ColorName, string>;

// Mondlicht: Nachtblau als Grund, Mondgold als Primaerfarbe, Lotusrosa und
// Meerglas als Akzente. Hell und dunkel sind gegenueber "Klar" vertauscht -
// die Rollen nicht. Text auf dem Grund liegt ueber 4,5:1:
//   ink900 #F5EFE3 auf #1D1938 ~ 14:1, ink700 #CFC7E6 ~ 9,5:1,
//   sage700 #9FD9C6 ~ 9,9:1, danger #F29A9A ~ 7:1,
//   surface #2A2550 auf ocean700 #EBC97F ~ 9:1 (Schrift auf Goldknopf).
const mondlicht: Palette = {
  background: '#1D1938',
  surface: '#2A2550',
  surfaceSubtle: '#262148',
  ink900: '#F5EFE3',
  ink700: '#CFC7E6',
  ink500: '#8E86B5',
  ocean700: '#EBC97F',
  ocean800: '#F5DDA6',
  ocean500: '#D9B66A',
  oceanTint: '#332D5E',
  oceanImageBg: '#332D5E',
  sage700: '#9FD9C6',
  sage500: '#6FB8A3',
  sageTint: '#28344F',
  line: '#3A3468',
  lineStrong: '#4A4380',
  focusRing: '#EFA9BC',
  warningSurface: '#4A3D1F',
  overlaySurface: 'rgba(29,25,56,0.9)',
  scrim: 'rgba(8,6,20,0.6)',
  danger: '#F29A9A',
  glow: '#EBC97F',
  blossom: '#EFA9BC',
};

export type ThemeName = 'klar' | 'mondlicht';
export const palettes: Record<ThemeName, Palette> = { klar, mondlicht };

/**
 * Was gilt, solange niemand gewaehlt hat. Im Testsystem seit 01.11.2026
 * Mondlicht (Wunsch des Users: erst die Farben machen es wirklich anders),
 * im Livesystem unveraendert Klar.
 */
export const DEFAULT_THEME: ThemeName = DESIGN_PREVIEW ? 'mondlicht' : 'klar';

const colorNames = Object.keys(klar) as ColorName[];

export const colors: Palette = DESIGN_PREVIEW
  ? (Object.fromEntries(colorNames.map((name) => [name, `var(--c-${name})`])) as Palette)
  : { ...klar };

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

const radiusKlar = { sm: 8, md: 12, lg: 16 } as const;
// Mondlicht ist weicher: groessere Ecken an Karten und Feldern.
const radiusMondlicht = { sm: 12, md: 20, lg: 28 } as const;
type RadiusName = keyof typeof radiusKlar;

export const radius: Record<RadiusName, number> & { full: number } = DESIGN_PREVIEW
  ? {
      // Eine CSS-Variable ist im Web ein gueltiger borderRadius; die
      // RN-Typen kennen fuer die Rechnung nur Zahlen, gerechnet wird mit
      // radius aber nirgends.
      sm: 'var(--r-sm)' as unknown as number,
      md: 'var(--r-md)' as unknown as number,
      lg: 'var(--r-lg)' as unknown as number,
      // Pillenform / Kreis - fuer Buttons, Chips, Avatare.
      full: 999,
    }
  : { ...radiusKlar, full: 999 };

/** Schriften je Darstellung; "Klar" bleibt bei der Systemschrift. */
export const fonts: Record<ThemeName, { body: string | null; display: string | null }> = {
  klar: { body: null, display: null },
  mondlicht: {
    body: "'Nunito', system-ui, sans-serif",
    display: "'Fraunces', Georgia, serif",
  },
};

function cssVars(palette: Palette, radii: Record<RadiusName, number>): string {
  const c = colorNames.map((name) => `--c-${name}:${palette[name]};`).join('');
  const r = (Object.keys(radii) as RadiusName[]).map((name) => `--r-${name}:${radii[name]}px;`).join('');
  return c + r;
}

/**
 * Das Stylesheet der Darstellungen fuer +html.tsx: Variablen fuer beide
 * Paletten, die selbst gehosteten Schriften (public/fonts, SIL OFL - keine
 * Anfrage an Google) und die Schriftzuweisung fuer Mondlicht.
 *
 * Die Schrift wird per Selektor gesetzt und nicht je Komponente:
 * react-native-web legt die Systemschrift als Klasse auf jedes Text-Element.
 * `:root[data-theme] *` ist spezifischer als eine einzelne Klasse und gewinnt.
 * Ueberschriften erkennt das Stylesheet an role="heading" bzw. h1-h6.
 */
export function themeCss(): string {
  const m = fonts.mondlicht;
  return [
    `:root{${cssVars(klar, radiusKlar)}}`,
    `:root[data-theme="mondlicht"]{${cssVars(mondlicht, radiusMondlicht)}color-scheme:dark;}`,
    `body{background-color:var(--c-background);}`,
    `@font-face{font-family:'Nunito';font-style:normal;font-weight:400 700;font-display:swap;src:url(/fonts/nunito-latin.woff2) format('woff2');}`,
    `@font-face{font-family:'Fraunces';font-style:normal;font-weight:300 700;font-display:swap;src:url(/fonts/fraunces-latin.woff2) format('woff2');}`,
    `@font-face{font-family:'Fraunces';font-style:italic;font-weight:300 700;font-display:swap;src:url(/fonts/fraunces-italic-latin.woff2) format('woff2');}`,
    `:root[data-theme="mondlicht"] *{font-family:${m.body};}`,
    `:root[data-theme="mondlicht"] [role="heading"],:root[data-theme="mondlicht"] h1,:root[data-theme="mondlicht"] h2,:root[data-theme="mondlicht"] h3,:root[data-theme="mondlicht"] [data-font="display"]{font-family:${m.display};font-weight:500;letter-spacing:0;}`,
  ].join('\n');
}
