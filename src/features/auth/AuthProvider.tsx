import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

// Die Sitzung gehoert Supabase (CLAUDE.md: "Nichts davon wird selbst gebaut").
// Hier steht ausschliesslich die Weitergabe an die Oberflaeche: supabase-js
// haelt Token, Erneuerung und Ablage selbst, dieser Provider spiegelt nur den
// jeweils aktuellen Stand in den React-Baum.
//
// Bewusst ein Context und kein Zustand-Store: es gibt genau einen Wert, er
// kommt aus einem Abonnement und wird nirgends von der Oberflaeche aus
// geschrieben. Ein Store waere hier ein bewegliches Teil ohne Aufgabe.

type AuthState = {
  session: Session | null;
  /** Vor der ersten Antwort von Supabase ist noch unbekannt, ob jemand angemeldet ist. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    // Erst der gespeicherte Stand (Neuladen der Seite, zweiter Besuch) ...
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });

    // ... dann jede weitere Aenderung: Anmelden, Abmelden, Token-Erneuerung,
    // und auch ein Abmelden in einem anderen Tab.
    //
    // In diesem Rueckruf steht bewusst nur setState. Supabase haelt waehrend
    // des Aufrufs eine interne Sperre; ein await auf eine weitere
    // supabase-Anfrage von hier aus laesst die Anwendung stehen.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
