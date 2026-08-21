import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/design/tokens';
import { DataExport } from '@/features/auth/DataExport';
import { DeleteAccount } from '@/features/auth/DeleteAccount';
import { ConsentPanel } from '@/features/consents/ConsentPanel';
import { SubscriptionPanel } from '@/features/plus/SubscriptionPanel';
import { supabase } from '@/lib/supabase';

// Der angemeldete Zustand.
//
// Die Reihenfolge ist Absicht und folgt dem, wonach jemand hier sucht: wer bin
// ich, was habe ich gebucht, wozu habe ich zugestimmt, wie komme ich an meine
// Daten - und ganz unten, ohne Umrandung, das Loeschen.
export function AccountPanel({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // display_name kommt aus profiles, steht aber genauso in den Metadaten der
  // Sitzung - fuer eine Begruessung lohnt keine eigene Abfrage.
  const fullName = session.user.user_metadata?.full_name;
  const name = typeof fullName === 'string' && fullName ? fullName : session.user.email;

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

      <View style={styles.divider} />
      <SubscriptionPanel />

      <View style={styles.divider} />
      <ConsentPanel />

      <View style={styles.divider} />
      <DataExport session={session} />

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
