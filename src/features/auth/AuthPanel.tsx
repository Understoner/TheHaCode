import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { ResetRequestForm } from '@/features/auth/ResetRequestForm';
import { SignInForm } from '@/features/auth/SignInForm';
import { SignUpForm } from '@/features/auth/SignUpForm';

type Mode = 'signIn' | 'signUp' | 'reset';

// Anmelden und Registrieren stehen auf derselben Seite und wechseln ueber zwei
// Schalter. Zwei getrennte Routen waeren zwei Adressen fuer denselben Vorgang -
// und wer sich vertippt hat, muesste die Seite wechseln statt umzuschalten.
//
// "Passwort vergessen" ist ein dritter Zustand desselben Kastens und keine
// eigene Seite: der Weg zurueck zum Anmelden soll ein Klick bleiben. Nur der
// zweite Schritt (neues Passwort setzen) braucht eine eigene Route, weil der
// Link aus der E-Mail irgendwo landen muss - /passwort-neu.
export function AuthPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('signIn');

  if (mode === 'reset') {
    return (
      <View style={styles.card}>
        <ResetRequestForm onBack={() => setMode('signIn')} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View role="tablist" style={styles.switch}>
        {(['signIn', 'signUp'] as const).map((value) => {
          const active = mode === value;
          return (
            <Pressable
              key={value}
              role="tab"
              aria-selected={active}
              onPress={() => setMode(value)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(`auth.${value}.title`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'signIn' ? <SignInForm /> : <SignUpForm />}

      {mode === 'signIn' ? (
        <Pressable onPress={() => setMode('reset')} style={styles.forgot}>
          <Text style={styles.forgotText}>{t('auth.reset.open')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  switch: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  tabText: {
    fontSize: 14,
    color: colors.ink700,
  },
  tabTextActive: {
    color: colors.ocean700,
    fontWeight: '600',
  },
  forgot: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
