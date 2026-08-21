import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { PressableRing } from '@/components/PressableRing';

// Konto endgueltig loeschen.
//
// Der Client kann das nicht selbst: auth.users ist nur ueber die Admin-API
// schreibbar und die verlangt service_role - der lebt ausschliesslich in den
// Supabase Function Secrets (CLAUDE.md). Deshalb ruft diese Komponente nur die
// Edge Function supabase/functions/delete-account auf; die prueft anhand des
// mitgeschickten Zugangstokens, wer anruft, und loescht genau dieses Konto.
//
// Zwei Schritte statt einem: der erste Druck oeffnet nur die Warnung. Ein
// einzelner Knopf "Konto loeschen" neben "Abmelden" waere zu leicht zu treffen
// fuer etwas, das sich nicht rueckgaengig machen laesst.
export function DeleteAccount() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [armed, setArmed] = useState(false);
  // Die eigene Adresse abtippen (Backlog T06). Zwei Schritte allein waren zu
  // wenig: der zweite Knopf sitzt genau dort, wo eben noch der erste war, und
  // wer zweimal schnell drueckt, hat sein Konto geloescht. Etwas abzutippen
  // laesst sich nicht aus Versehen tun.
  const [confirmText, setConfirmText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user.email ?? '';
  // Gross- und Kleinschreibung ist bei E-Mail-Adressen keine Aussage, und
  // Leerzeichen fangen wir gleich mit ab - sonst scheitert es an einem
  // kopierten Zeilenumbruch statt an der Absicht.
  const matches = confirmText.trim().toLowerCase() === email.trim().toLowerCase() && email !== '';

  const remove = async () => {
    if (!matches) return;
    setError(null);
    setPending(true);

    try {
      const { error: callError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (callError) throw callError;

      // Das Konto ist weg, die Sitzung im Browser noch da. Ohne signOut bliebe
      // die Oberflaeche angemeldet, bis der Zugangstoken von selbst ablaeuft.
      await supabase.auth.signOut();
    } catch {
      setPending(false);
      setError(t('errors:auth.deleteFailed'));
    }
  };

  if (!armed) {
    return (
      <PressableRing onPress={() => setArmed(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>{t('auth.delete.open')}</Text>
      </PressableRing>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('auth.delete.title')}</Text>
      <Text style={styles.body}>{t('auth.delete.body')}</Text>
      <Text style={styles.body}>{t('auth.delete.confirmHint', { email })}</Text>

      <TextField
        label={t('auth.delete.confirmLabel')}
        value={confirmText}
        onChangeText={setConfirmText}
        onBlur={() => {}}
        inputMode="email"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.row}>
        <PressableRing
          disabled={pending || !matches}
          aria-disabled={pending || !matches}
          onPress={() => void remove()}
          style={[styles.confirm, (pending || !matches) && styles.confirmPending]}
        >
          <Text style={[styles.confirmText, (pending || !matches) && styles.confirmTextPending]}>
            {pending ? t('auth.delete.pending') : t('auth.delete.confirm')}
          </Text>
        </PressableRing>

        <PressableRing
          disabled={pending}
          onPress={() => {
            setArmed(false);
            setConfirmText('');
          }}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>{t('auth.delete.cancel')}</Text>
        </PressableRing>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  triggerText: {
    fontSize: 13,
    color: colors.ink700,
    textDecorationLine: 'underline',
  },
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  error: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirm: {
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  // Wie beim Button: kein opacity, sonst faellt Weiss auf Rot unter 4,5:1.
  confirmPending: {
    backgroundColor: colors.lineStrong,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.surface,
  },
  confirmTextPending: {
    color: colors.ink900,
  },
  cancel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
