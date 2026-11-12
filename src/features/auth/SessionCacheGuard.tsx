import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

// Beim Wechsel des Kontos gehoert der Zwischenspeicher nicht mehr dazu
// (Review 11.11.2026, S11).
//
// TanStack Query haelt geladene Daten im Speicher des Tabs. Bis dahin blieben
// sie beim Abmelden einfach liegen: die Tagebuch-Eintraege des vorigen Kontos
// - Gesundheitsdaten nach Art. 9 - bis zum Neuladen der Seite, und Listen
// ohne Nutzer-ID im Schluessel zeigten dem naechsten Konto kurz den Stand des
// vorigen. Am gemeinsam genutzten Geraet ist das genau der Fall, der nicht
// passieren soll.
//
//   Abmelden oder Kontowechsel -> alles verwerfen. resetQueries() setzt jede
//     Abfrage auf "noch nie geladen" und laedt die gerade sichtbaren neu,
//     jetzt mit den Rechten des neuen Zustands.
//   Anmelden -> nichts verwerfen (es war nichts Privates da), aber die
//     sichtbaren Listen neu laden: manche zeigen angemeldet mehr.
//
// Eine Token-Erneuerung aendert die Nutzer-ID nicht und loest nichts aus.
// Rendert nichts; steht im Root-Layout innerhalb von AuthProvider.
export function SessionCacheGuard() {
  const queryClient = useQueryClient();
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  // undefined = der erste bekannte Stand steht noch aus.
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;

    const before = previous.current;
    previous.current = userId;

    if (before === undefined || before === userId) return;

    if (before !== null) {
      void queryClient.resetQueries();
    } else {
      void queryClient.invalidateQueries();
    }
  }, [loading, userId, queryClient]);

  return null;
}
