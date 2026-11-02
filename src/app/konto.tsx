import type { ReactNode } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { PageColumn } from '@/design/PageColumn';
import { displayFont, responsive } from '@/design/responsive';
import { colors, DESIGN_PREVIEW, spacing } from '@/design/tokens';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { AuthPanel } from '@/features/auth/AuthPanel';
import { useAuth } from '@/features/auth/AuthProvider';
import { AccountMondlicht, GuestWelcome } from '@/features/auth/KontoMondlicht';
import { PlanTiers } from '@/features/plus/PlanTiers';

export default function KontoScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const { modus } = useLocalSearchParams<{ modus?: string }>();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Column>
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
            // Gaeste: Begruessung und Formular nebeneinander (Desktop), darunter
            // der Vergleich ohne Konto / Konto / Plus.
            <>
              <View {...responsive('m-split')} style={styles.split}>
                <GuestWelcome />
                <AuthPanel key={modus ?? ''} initialMode={modus === 'registrieren' ? 'signUp' : 'signIn'} />
              </View>
              <PlanTiers hideRegister />
            </>
          )
        ) : session ? (
          <AccountPanel session={session} />
        ) : (
          <AuthPanel />
        )}
      </Column>
    </ScrollView>
  );
}

// Im Testsystem steht alles in der zentrierten Seitenspalte (PageColumn,
// 02.11.2026), im Livesystem bleibt die Seite wie bisher.
function Column({ children }: { children: ReactNode }) {
  return DESIGN_PREVIEW ? <PageColumn gap={spacing.lg}>{children}</PageColumn> : <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  split: {
    gap: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
});
