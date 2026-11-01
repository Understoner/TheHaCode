import { useSyncExternalStore } from 'react';

import { DEFAULT_THEME, DESIGN_PREVIEW, palettes, type Palette, type ThemeName } from './tokens';

// Welche Darstellung gerade gilt (01.11.2026, nur Testsystem).
//
// Die Wahrheit steht am <html> als data-theme. Gesetzt wird es zweimal: vor
// dem ersten Bild von public/theme-init.js (sonst blitzte Mondlicht beim
// Laden kurz hell auf) und beim Umschalten von setTheme().
//
// GESPEICHERT IM GERAET, NICHT IM PROFIL
// --------------------------------------
// localStorage ist fuer fachliche Daten verboten (CLAUDE.md). Die Darstellung
// ist keine: sie sagt nichts ueber die Person und ihre Atmung, nur wie die
// Seite auf diesem Geraet aussieht - wie eine Schriftgroesse im Browser.
// Eine Profilspalte braeuchte eine Migration, und die liesse sich nicht mit
// einem Revert zuruecknehmen (supabase db push scheitert an einer
// eingespielten Migration, die im Repo fehlt). Der Schluessel muss mit
// public/theme-init.js uebereinstimmen.

export const THEME_STORAGE_KEY = 'thehacode.theme';

const listeners = new Set<() => void>();

function readTheme(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const value = document.documentElement.dataset.theme;
  return value === 'klar' || value === 'mondlicht' ? value : DEFAULT_THEME;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Die aktuelle Darstellung. Beim statischen Rendern die Grundeinstellung, im Livesystem immer "klar". */
export function useThemeName(): ThemeName {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return DESIGN_PREVIEW ? theme : 'klar';
}

/** Die Farbwerte als Hex - fuer SVG-Attribute, die CSS-Variablen nicht ueberall aufloesen. */
export function useThemePalette(): Palette {
  return palettes[useThemeName()];
}

export function setTheme(theme: ThemeName) {
  if (!DESIGN_PREVIEW || typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palettes[theme].background);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Privates Fenster oder gesperrter Speicher: gilt dann nur fuer diesen Besuch.
  }
  listeners.forEach((listener) => listener());
}
