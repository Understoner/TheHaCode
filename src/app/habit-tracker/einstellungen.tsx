import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHabitScoreEnabled, useMyHabits } from '@/features/habits/useHabits';

/**
 * Die Einstellungen des Tagebuchs (30.10.2026), erreichbar ueber das
 * Zahnrad neben der Ueberschrift. Jede Einstellung ist eine Karte - weitere
 * kommen als weitere Karte dazu, ohne die Seite umzubauen.
 */
export default function EinstellungenScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker" style={styles.back}>
        {t('diary.back')}
      </Link>
      <Text style={styles.title}>{t('diary.settings.title')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <Settings />
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

function Settings() {
  const { t } = useTranslation();
  const { scoreOn, setScoreOn } = useHabitScoreEnabled();
  const myHabits = useMyHabits();

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, styles.grow]}>{t('diary.score.toggle')}</Text>
          <PressableRing
            onPress={() => setScoreOn(!scoreOn)}
            role="switch"
            aria-checked={scoreOn}
            aria-label={t('diary.score.toggle')}
            style={[styles.toggle, scoreOn && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, scoreOn && styles.toggleTextOn]}>
              {scoreOn ? t('diary.score.on') : t('diary.score.off')}
            </Text>
          </PressableRing>
        </View>
        <Text style={styles.text}>{t('diary.settings.score')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('diary.picker.title')}</Text>
        <QueryBoundary query={myHabits}>
          {(habits) => (
            <Text style={styles.text}>
              {t('diary.settings.habits', { count: habits.filter((h) => h.is_active).length })}
            </Text>
          )}
        </QueryBoundary>
        <Link href="/habit-tracker/auswahl" style={styles.primary}>
          {t('diary.settings.habitsAction')}
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    width: '100%',
    // Formularseite: lesbar schmal wie die BOLT-Messung.
    maxWidth: 720,
    alignSelf: 'center',
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
  stack: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
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
  primary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  toggle: {
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  toggleOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  toggleText: {
    fontSize: 13,
    color: colors.ink700,
  },
  toggleTextOn: {
    color: colors.ocean700,
    fontWeight: '600',
  },
});
