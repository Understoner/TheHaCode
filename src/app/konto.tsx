import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { colors, spacing } from '@/design/tokens';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { AuthPanel } from '@/features/auth/AuthPanel';
import { useAuth } from '@/features/auth/AuthProvider';

export default function KontoScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('konto.title')}</Text>

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
});
