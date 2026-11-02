import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { displayFont } from '@/design/responsive';
import { colors, DESIGN_PREVIEW, spacing } from '@/design/tokens';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { AuthPanel } from '@/features/auth/AuthPanel';
import { useAuth } from '@/features/auth/AuthProvider';
import { AccountMondlicht, GuestWelcome } from '@/features/auth/KontoMondlicht';

export default function KontoScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text role="heading" aria-level={1} {...displayFont} style={styles.title}>
        {t('konto.title')}
      </Text>

      {/* Solange Supabase die gespeicherte Sitzung noch prueft, ist weder
          "angemeldet" noch "nicht angemeldet" wahr. Ohne diesen Zwischenschritt
          blitzt beim Neuladen jedes Mal kurz das Anmeldeformular auf, obwohl
          man laengst angemeldet ist. */}
      {loading ? (
        <SkeletonList />
      ) : DESIGN_PREVIEW ? (
        // Im Testsystem im Design des Vorschlags "Mondlicht Mobile" (02.11.2026).
        session ? (
          <AccountMondlicht session={session} />
        ) : (
          <>
            <GuestWelcome />
            <AuthPanel />
          </>
        )
      ) : session ? (
        <AccountPanel session={session} />
      ) : (
        <AuthPanel />
      )}
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
});
