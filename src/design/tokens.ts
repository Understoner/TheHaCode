// Einzige Quelle für Farbwerte (CLAUDE.md: keine Farbliterale in Komponenten).
// Wird erweitert, sobald das UI-Spezifikationsdokument (ui/*.svg) umgesetzt wird.

export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text700: '#3D3D3D',
  brand700: '#0F5C4A',
  // Flaeche fuer Hinweisbanner (z. B. Staging). text700 darauf: Kontrast ~9,9:1.
  warningSurface: '#FDECC8',
  // Abgrenzung ueber 1-px-Linien statt Schatten (CLAUDE.md).
  line: '#E8EDF1',
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
