import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { NewPasswordForm } from '@/features/auth/NewPasswordForm';
import { urlErrorMessageKey } from '@/features/auth/authErrors';

// Ziel des Links aus der "Passwort vergessen"-Mail.
//
// Die Adresse muss in supabase/config.toml unter additional_redirect_urls
// stehen (und im Dashboard des jeweiligen Projekts), sonst weist Supabase den
// Ruecksprung ab und der Nutzer landet ohne Sitzung hier.
export default function PasswortNeuScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = urlErrorMessageKey(window.location.href);
    // Bewusst im Effekt statt als Anfangswert - Begruendung wie in
    // src/app/konto.tsx: zur Bauzeit gibt es keine Adresse, und ein
    // abweichender erster Render im Browser verwirft den ganzen Baum.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (key) setLinkError(key);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('passwortNeu.title')}</Text>

      <View style={styles.card}>
        {linkError ? (
          <Abgelaufen messageKey={linkError} />
        ) : loading ? (
          <SkeletonList />
        ) : session ? (
          <NewPasswordForm />
        ) : (
          // Ohne Sitzung ist der Link entweder abgelaufen, schon benutzt oder
          // jemand hat die Adresse von Hand aufgerufen. Fuer den Nutzer ist der
          // Unterschied ohne Belang - er braucht einen neuen Link.
          <Abgelaufen messageKey="errors:auth.linkExpired" />
        )}
      </View>
    </ScrollView>
  );
}

function Abgelaufen({ messageKey }: { messageKey: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t('passwortNeu.expiredTitle')}</Text>
      <Text style={styles.body}>{t(messageKey)}</Text>
      <Link href="/konto" style={styles.link}>
        {t('passwortNeu.newLink')}
      </Link>
    </View>
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
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  block: {
    gap: spacing.sm,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
