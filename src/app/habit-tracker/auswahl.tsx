import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { HabitCatalog } from '@/features/habits/HabitCatalog';
import { useHabitCatalog, useHabitFavorites, useMyHabits } from '@/features/habits/useHabits';

/**
 * Eigene Seite fuer die Habit-Auswahl (seit 25.10.2026). Im Tagebuch selbst
 * wurde die Liste mit jedem neuen Habit laenger und schob den Tag nach unten;
 * hier ist Platz fuer Filter, Favoriten und eigene Habits.
 */
export default function HabitsScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/habit-tracker" style={styles.back}>
        {t('habits.back')}
      </Link>
      <Text style={styles.title}>{t('diary.picker.title')}</Text>
      <Text style={styles.intro}>{t('habits.intro')}</Text>

      {loading ? (
        <SkeletonList />
      ) : session ? (
        <HabitsForUser />
      ) : (
        <StateMessage title={t('diary.login.title')} body={t('diary.login.text')} />
      )}
    </ScrollView>
  );
}

function HabitsForUser() {
  const { t } = useTranslation();
  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const favorites = useHabitFavorites();
  const plus = usePlusAccess();

  return (
    <QueryBoundary query={plus}>
      {(plusAccess) => (
        <View style={styles.stack}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('habits.own.title')}</Text>
            <Text style={styles.text}>
              {plusAccess ? t('habits.own.text') : t('habits.own.plusOnly')}
            </Text>
            {plusAccess ? (
              <Link href="/habit-tracker/eigenes-habit" style={styles.primary}>
                {t('habits.own.create')}
              </Link>
            ) : (
              <Link href="/plus" style={styles.link}>
                {t('diary.picker.toPlus')}
              </Link>
            )}
          </View>

          <QueryBoundary query={catalog}>
            {({ categories, templates }) => (
              <QueryBoundary query={myHabits}>
                {(habits) => (
                  <QueryBoundary query={favorites}>
                    {(favoriteIds) => (
                      <HabitCatalog
                        categories={categories}
                        templates={templates}
                        myHabits={habits}
                        favorites={favoriteIds}
                        plusAccess={plusAccess}
                      />
                    )}
                  </QueryBoundary>
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        </View>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    width: '100%',
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
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
  },
  stack: {
    gap: spacing.lg,
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
});
