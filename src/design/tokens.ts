// Einzige Quelle für Farbwerte (CLAUDE.md: keine Farbliterale in Komponenten).
// Wird erweitert, sobald das UI-Spezifikationsdokument (ui/*.svg) umgesetzt wird.

export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text700: '#3D3D3D',
  brand700: '#0F5C4A',
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
