import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { StateMessage } from '@/components/StateMessage';
import { colors, spacing } from '@/design/tokens';
import i18n from '@/i18n';

// Die Fehlergrenze der ganzen App (Review 11.11.2026, W3).
//
// WARUM ES DAS BRAUCHT
// --------------------
// Wirft eine Komponente beim Rendern und faengt es niemand, baut React den
// GANZEN Baum ab: die Seite ist weiss, ohne Text, ohne Knopf. Das ist am
// iPhone schon passiert (src/lib/contentSecurityPolicy.ts beschreibt den
// Fall) und wurde von Hand gefunden. QueryBoundary faengt Fehler beim LADEN
// von Daten - diese Komponente faengt, was beim ANZEIGEN schiefgeht.
//
// Eine Klasse, weil React Fehlergrenzen nur so kennt (componentDidCatch); es
// gibt dafuer keinen Hook.
//
// WAS HIER FEHLT: die Meldung an uns. CLAUDE.md nennt Sentry als Ziel der
// technischen Details, eingebaut ist es nicht (neue Bibliothek, Eintrag im
// Verarbeitungsverzeichnis - eine Entscheidung des Teams). Bis dahin landet
// der Fehler nur in der Konsole des Browsers. onError ist die Stelle, an der
// ein Monitoring spaeter andockt.

type Props = {
  children: ReactNode;
  /** Wechselt der Wert, wird ein gezeigter Fehler verworfen - etwa beim Seitenwechsel. */
  resetKey?: string;
  onError?: (error: unknown, info: ErrorInfo) => void;
};

type State = { failed: boolean; failedAtKey: string | undefined };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, failedAtKey: undefined };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  /**
   * Nach einem Seitenwechsel einen neuen Versuch: der Fehler gehoerte zur
   * alten Seite. Ohne das bliebe die Meldung stehen, auch wenn jemand ueber
   * die Navigation laengst woanders ist.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.failed && state.failedAtKey === undefined) {
      return { failedAtKey: props.resetKey ?? '' };
    }
    if (state.failed && state.failedAtKey !== (props.resetKey ?? '')) {
      return { failed: false, failedAtKey: undefined };
    }
    return null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Keine Nutzdaten: nur der Fehler und der Komponentenpfad.
    console.error('Anzeigefehler', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <View role="alert" style={styles.container}>
        <StateMessage
          title={i18n.t('errors:app.crash.title')}
          body={i18n.t('errors:app.crash.body')}
          actionLabel={i18n.t('errors:app.crash.reload')}
          onAction={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
  },
});
