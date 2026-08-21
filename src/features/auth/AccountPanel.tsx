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
      {/* Der Kopf ist bewusst knapp gehalten: er sagt, wer angemeldet ist, und
          bietet das Abmelden an - mehr nicht. Alles Weitere steht darunter und
          soll ohne Scrollen sichtbar sein. Deshalb Titel, Name und Knopf in
          EINER Reihe statt in dreien; auf schmalen Bildschirmen rutscht der
          Knopf per flexWrap von selbst darunter, ohne Media Query. */}
      <View style={[styles.card, styles.header]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('auth.signedIn.title')}</Text>
          <Text style={styles.body}>{t('auth.signedIn.as', { name })}</Text>
        </View>

        <Button
          disabled={pending}
          label={pending ? t('auth.signOutPending') : t('auth.signOut')}
          onPress={() => void signOut()}
        />

        {error ? (
          <View role="alert" style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
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
  },
  header: {
    // BEIDE Flex-Angaben aus styles.card muessen hier zurueckgenommen werden,
    // und der Grund ist derselbe: sie sind fuer das Raster gedacht, in dem die
    // Hauptrichtung WAAGRECHT ist. Der Kopf steht aber direkt in der Spalte
    // darueber, und dort wirken sie auf die HOEHE:
    //
    //   flexGrow: 1      -> die Karte waechst ueber den ganzen freien Platz
    //   flexBasis: 100%  -> ihre Ausgangshoehe ist die volle Containerhoehe
    //
    // Das zweite war der eigentliche Uebeltaeter: gemessen 785 Pixel fuer zwei
    // Zeilen Text, auch nachdem flexGrow schon auf 0 stand.
    flexGrow: 0,
    flexBasis: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Knapper als die uebrigen Karten: der Kopf traegt zwei Zeilen Text, kein
    // Formular. Mit spacing.lg ringsum kostete er ueber 160 Pixel Hoehe und
    // schob alles Weitere unter den Bildschirmrand.
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  quiet: {
    backgroundColor: colors.surfaceSubtle,
  },
  headerText: {
    // Waechst in die freie Breite, damit der Knopf rechts steht - und faellt
    // unter 220px auf eine eigene Zeile.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
    gap: 2,
  },
  title: {
    fontSize: 16,
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
    // Volle Zeile: der Kopf ist eine flexWrap-Reihe, sonst quetschte sich die
    // Meldung neben den Abmelden-Knopf.
    flexBasis: '100%',
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
