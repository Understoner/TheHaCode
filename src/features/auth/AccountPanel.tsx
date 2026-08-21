import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { responsive } from '@/design/responsive';
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
// Daten - und ganz zuletzt das Loeschen.
//
// ZUR BREITE
// ----------
// Bis T17 stand hier nur "Du bist angemeldet" und ein Knopf; eine Karte mit
// maxWidth 420 war dafuer genau richtig. Mit Abo, Einwilligungen und
// Datenauskunft haengen jetzt vier Bereiche in derselben schmalen Spalte,
// waehrend auf dem Desktop die halbe Seite leer bleibt - und die
// Einwilligungstexte brechen nach jedem dritten Wort um.
//
// Deshalb: eine Kopfzeile ueber die volle Breite, darunter die Bereiche als
// eigene Karten, die ab dem Breakpoint zu zweit nebeneinander stehen
// ('konto-grid' in src/design/responsive.ts). Mobil aendert sich nichts - dort
// war es nie zu schmal.
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
    <View style={styles.page}>
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
      </View>

      <View {...responsive('konto-grid')} style={styles.grid}>
        <View style={styles.card}>
          <SubscriptionPanel />
        </View>

        <View style={styles.card}>
          <ConsentPanel />
        </View>

        <View style={styles.card}>
          <DataExport session={session} />
        </View>

        {/* Das Loeschen steht in einer eigenen Karte, aber ohne Betonung: es
            gehoert auf diese Seite, soll aber nicht wie die naechstliegende
            Handlung aussehen. */}
        <View style={[styles.card, styles.quiet]}>
          <DeleteAccount />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignSelf: 'center',
    width: '100%',
    // Breiter als eine Textspalte, aber nicht die ganze Seite: ab etwa dieser
    // Breite stehen die beiden Spalten bequem nebeneinander, und die
    // Zeilenlaenge in den Karten bleibt lesbar.
    maxWidth: 980,
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  card: {
    // Ohne flexGrow zieht eine einzelne Karte in einer Reihe nicht auf, mit
    // flexBasis aus der Media Query stehen sie zu zweit. Mobil bleibt es bei
    // einer Karte pro Reihe (flexBasis 100%).
    flexGrow: 1,
    flexBasis: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  quiet: {
    backgroundColor: colors.surfaceSubtle,
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
