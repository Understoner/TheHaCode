import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { InsightsForUser } from '@/features/habits/InsightsForUser';

/**
 * Die Auswertung des Tagebuchs auf eigener Seite (30.10.2026), erreichbar
 * ueber das Balkensymbol neben der Ueberschrift. Lesen geht immer, auch nach
 * Widerruf der Einwilligung (SAD §3.10) - deshalb fragt diese Seite die
 * Einwilligung nicht ab.
 */
export default function AuswertungScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker" style={styles.back}>
        {t('diary.back')}
      </Link>
      <Text style={styles.title}>{t('diary.analysis.title')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <InsightsForUser />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('diary.login.title')}</Text>
          <Text style={styles.text}>{t('diary.login.text')}</Text>
          <Link href="/konto" style={styles.link}>
            {t('diary.login.action')}
          </Link>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    // Volle Breite wie das Tagebuch; die Karten verteilen sich ueber
    // habits-grid.
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
