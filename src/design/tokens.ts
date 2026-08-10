// Einzige Quelle fuer Farbwerte (CLAUDE.md: keine Farbliterale in Komponenten).
// Ocean/Salbei-System, uebernommen aus ui/references/*.svg (10.08.2026).
// Kontrastregel bleibt bindend: Fliesstext ausschliesslich in den 700er-Toenen
// (>=4,5:1 auf background/surface). Die 500er sind reine Flaechenfarben.

export const colors = {
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
  // Destruktive Aktionen (z. B. "Block loeschen" im Konfigurator, spaeter).
  danger: '#B45A5A',
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  // Pillenform / Kreis - fuer Buttons, Chips, Avatare.
  full: 999,
} as const;
