import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { authErrorMessageKey } from '@/features/auth/authErrors';
import { signInWithProvider, type OAuthProvider } from '@/features/auth/oauth';
import { useAuthProviders } from '@/features/auth/useAuthProviders';

// Bewusst ohne die Herstellerlogos: die gibt es nur als Bilddatei oder als
// mehrfarbiges SVG, und beides hiesse entweder eine neue Abhaengigkeit oder
// Markenfarben als Literale in einer Komponente (CLAUDE.md verbietet beides).
// Zwei klar beschriftete Schaltflaechen sagen dasselbe. Sobald die Anbieter
// wirklich eingerichtet sind, gehoeren die offiziellen Marken-Buttons her -
// Apple schreibt ihre Gestaltung fuer "Sign in with Apple" vor.
export function OAuthButtons() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  // ABWEICHUNG von der QueryBoundary-Regel (CLAUDE.md, SAD §6.2), und zwar
  // absichtlich: Das hier ist kein Seiteninhalt, sondern eine Beigabe zum
  // Anmeldeformular. Ein Skelett waehrend des Ladens wuerde das Formular
  // beim Eintreffen nach unten schieben, und eine Fehlermeldung waere hier
  // schlicht falsch - wer sich anmelden will, kann das ueber E-Mail und
  // Passwort ohnehin. Beide Faelle enden deshalb in "nichts anzeigen".
  const { data: providers = [] } = useAuthProviders();

  const start = async (provider: OAuthProvider) => {
    setError(null);
    setPending(provider);
    const { error: startError } = await signInWithProvider(provider);
    // Beim Erfolg verlaesst der Browser die Seite - alles danach ist nur der
    // Fall, dass der Absprung selbst nicht geklappt hat.
    setPending(null);
    if (startError) setError(t(authErrorMessageKey(startError)));
  };

  // Kein eingeschalteter Anbieter, kein Bereich - und auch keine Trennlinie
  // mit "oder", die dann ins Nichts trennen wuerde.
  if (providers.length === 0) return null;

  return (
    <View style={styles.block}>
      {providers.map((provider) => (
        <Pressable
          key={provider}
          disabled={pending !== null}
          aria-disabled={pending !== null}
          onPress={() => void start(provider)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {pending === provider ? t('auth.oauth.pending') : t(`auth.oauth.${provider}`)}
          </Text>
        </Pressable>
      ))}

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {/* Trennlinie mit Wort in der Mitte: zwei 1-px-Linien und Weissraum,
          kein Schatten und kein Kasten (CLAUDE.md). */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.oauth.or')}</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink900,
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontSize: 12,
    color: colors.ink700,
  },
});
