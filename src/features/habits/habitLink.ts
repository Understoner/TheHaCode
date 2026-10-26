// Der Link an einem eigenen Habit (Migration 0030): ein Pfad in der App
// ("/sessions/...") oder eine Adresse nach draussen. Dieselben Regeln wie der
// Trigger in der Datenbank - hier, damit das Formular verstaendlich meldet,
// und noch einmal beim Oeffnen, weil die Spalte auch Altbestand tragen kann.

import { safeExternalUrl } from '@/lib/externalLink';

// Genau ein fuehrender Schraegstrich: "//host" waere eine fremde Seite.
const APP_PATH = /^\/(?!\/)[^\s"'<>]*$/;

export type HabitLinkTarget =
  { kind: 'app'; href: string; isSession: boolean } | { kind: 'external'; href: string };

export function isValidHabitLink(value: string): boolean {
  const trimmed = value.trim();
  return (
    APP_PATH.test(trimmed) || (/^https?:\/\//.test(trimmed) && safeExternalUrl(trimmed) !== null)
  );
}

/**
 * Eine kopierte Adresse dieser App wird zum Pfad. Wer die Adresszeile einer
 * Session in Staging kopiert, soll denselben Link auch nach der Befoerderung
 * nach Live noch benutzen koennen - und er oeffnet sich in der App statt in
 * einem neuen Fenster.
 */
export function normalizeHabitLink(value: string, appOrigin: string | null): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (appOrigin && /^https?:\/\//.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.origin === appOrigin) return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      // Unverstaendliche Adressen lehnt die Pruefung davor ab.
    }
  }
  return trimmed;
}

export function habitLinkTarget(value: string | null | undefined): HabitLinkTarget | null {
  if (!value) return null;
  if (APP_PATH.test(value)) {
    return {
      kind: 'app',
      href: value,
      isSession: value.startsWith('/sessions/'),
    };
  }
  const safe = safeExternalUrl(value);
  return safe && /^https?:/.test(safe) ? { kind: 'external', href: safe } : null;
}

/** Die Herkunft der laufenden Seite im Web, sonst null. */
export function currentOrigin(): string | null {
  return typeof window !== 'undefined' && window.location ? window.location.origin : null;
}
