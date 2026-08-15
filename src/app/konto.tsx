import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { AuthPanel } from '@/features/auth/AuthPanel';
import { useAuth } from '@/features/auth/AuthProvider';
import { urlErrorMessageKey } from '@/features/auth/authErrors';

export default function KontoScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const [returnError, setReturnError] = useState<string | null>(null);

  // Google und Apple springen hierher zurueck. Ist dabei etwas schiefgegangen
  // - abgebrochen, Anbieter nicht eingerichtet -, steht das nur in der
  // Adresse. Ohne diese Auswertung stuende der Nutzer wortlos wieder vor dem
  // Anmeldeformular.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = urlErrorMessageKey(window.location.href);
    if (!key) return;

    // Bewusst im Effekt und nicht als Anfangswert des useState: die Seite wird
    // zur Bauzeit vorgerendert (SAD §2.5) und kennt dort keine Adresse. Ein
    // Anfangswert aus window waere beim Hydrieren etwas anderes als im
    // ausgelieferten HTML - React verwirft dann den ganzen Baum
    // (siehe src/design/responsive.ts). Der eine zusaetzliche Render danach
    // ist der Preis dafuer und hier richtig.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReturnError(key);
    // Die Adresse wieder saubermachen: sonst zeigt jedes Neuladen und jedes
    // Teilen des Links denselben alten Fehler.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Nach Google oder Apple haengt ein ?code=... in der Adresse. Bewusst erst
  // aufgeraeumt, WENN eine Sitzung da ist: supabase-js tauscht diesen Code
  // beim Laden gegen die Sitzung ein (detectSessionInUrl), und ihn vorher zu
  // entfernen waere ein Wettlauf mit dem eigenen Anmeldevorgang. Sonst bliebe
  // er in der Adresszeile stehen - und in jedem Lesezeichen, das von hier aus
  // gesetzt wird.
  const angemeldet = Boolean(session);
  useEffect(() => {
    if (typeof window === 'undefined' || !angemeldet) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('code')) return;
    url.searchParams.delete('code');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [angemeldet]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('konto.title')}</Text>

      {returnError ? (
        <View role="alert" style={styles.notice}>
          <Text style={styles.noticeText}>{t(returnError)}</Text>
        </View>
      ) : null}

      {/* Solange Supabase die gespeicherte Sitzung noch prueft, ist weder
          "angemeldet" noch "nicht angemeldet" wahr. Ohne diesen Zwischenschritt
          blitzt beim Neuladen jedes Mal kurz das Anmeldeformular auf, obwohl
          man laengst angemeldet ist. */}
      {loading ? <SkeletonList /> : session ? <AccountPanel session={session} /> : <AuthPanel />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  notice: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink900,
  },
});
