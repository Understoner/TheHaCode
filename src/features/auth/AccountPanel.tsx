import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/design/tokens';
import { DeleteAccount } from '@/features/auth/DeleteAccount';
import { supabase } from '@/lib/supabase';

// Der angemeldete Zustand. Bewusst kurz: mehr als "wer bin ich" und "wieder
// abmelden" gibt es in V1 noch nicht zu sehen - Sequenzen und Konfigurator
// kommen erst.
export function AccountPanel({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // display_name kommt aus profiles, steht aber genauso in den Metadaten der
  // Sitzung - fuer eine Begruessung lohnt keine eigene Abfrage.
  const fullName = session.user.user_metadata?.full_name;
  const name = typeof fullName === 'string' && fullName ? fullName : session.user.email;

  // Ein Anbieter kann mehrfach auftauchen, wenn Supabase spaeter einmal
  // mehrere Identitaeten desselben Typs verknuepft - deshalb ueber ein Set.
  const identities = [...new Set((session.user.identities ?? []).map((i) => i.provider))];

  const signOut = async () => {
    setError(null);
    setPending(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setPending(false);
    // Beim Erfolg meldet onAuthStateChange die leere Sitzung, und diese
    // Komponente verschwindet - hier ist nichts weiter zu tun.
    if (signOutError) setError(t('errors:auth.signOutFailed'));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('auth.signedIn.title')}</Text>
      <Text style={styles.body}>{t('auth.signedIn.as', { name })}</Text>

      {/* Womit man angemeldet ist, steht in auth.identities - und nicht in
          einer eigenen Spalte (CLAUDE.md: "keine eigene auth_provider-Spalte.
          Ein Konto kann mehrere Provider haben"). Genau deshalb ist es eine
          Liste: wer sich einmal mit E-Mail und einmal mit Google angemeldet
          hat, sieht hier beides und weiss beim naechsten Mal, was er nehmen
          kann. */}
      {identities.length > 0 ? (
        <View style={styles.identities}>
          <Text style={styles.identityLabel}>{t('auth.signedIn.providers')}</Text>
          <View style={styles.identityRow}>
            {identities.map((provider) => (
              <View key={provider} style={styles.identityChip}>
                {/* defaultValue statt eines fehlenden Textes: kommt spaeter
                    ein Anbieter dazu, steht hier sein Name und nicht der
                    rohe Schluessel. */}
                <Text style={styles.identityChipText}>
                  {t(`auth.provider.${provider}`, { defaultValue: provider })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.body}>{t('auth.signedIn.hint')}</Text>

      {error ? (
        <View role="alert" style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        disabled={pending}
        label={pending ? t('auth.signOutPending') : t('auth.signOut')}
        onPress={() => void signOut()}
      />

      {/* Das Loeschen steht unter einer Trennlinie und ohne Umrandung: es
          gehoert auf diese Seite, soll aber nicht wie die naechstliegende
          Handlung aussehen. */}
      <View style={styles.divider} />
      <DeleteAccount />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  identities: {
    gap: 6,
  },
  identityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  identityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  identityChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.oceanTint,
  },
  identityChipText: {
    fontSize: 13,
    color: colors.ocean700,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginTop: spacing.sm,
  },
  error: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink900,
  },
});
