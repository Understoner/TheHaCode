import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { PageColumn } from '@/design/PageColumn';
import { displayFont } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { WEARABLES_ENABLED } from '@/features/wearables/flag';
import { WearableDevices } from '@/features/wearables/WearableDevices';

/**
 * Geraete verbinden (0053, 07.11.2026, nur Testsystem): Oura und Garmin
 * fuellen Schritte, Schlaf und weitere Habits. Rueckkehr vom Anbieter landet
 * ebenfalls hier (redirect_uri, supabase/functions/_shared/wearables.ts).
 */
export default function GeraeteScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PageColumn gap={spacing.md}>
        <Link href="/habit-tracker/einstellungen" style={styles.back}>
          {t('wearables.devices.back')}
        </Link>
        <Text style={styles.title} {...displayFont}>
          {t('wearables.devices.title')}
        </Text>

        {!WEARABLES_ENABLED ? (
          <View style={styles.card}>
            <Text style={styles.text}>{t('wearables.devices.unavailable')}</Text>
          </View>
        ) : loading ? (
          <SkeletonList />
        ) : session ? (
          <WearableDevices />
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('diary.login.title')}</Text>
            <Text style={styles.text}>{t('diary.login.text')}</Text>
            <Link href="/konto" style={styles.link}>
              {t('diary.login.action')}
            </Link>
          </View>
        )}
      </PageColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    width: '100%',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
