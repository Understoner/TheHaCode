import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { addDays, monthDays, today as heute, type IsoDate } from '@/features/habits/dates';
import { DiaryConsent } from '@/features/habits/DiaryConsent';
import { DiaryHeader } from '@/features/habits/DiaryHeader';
import { DiaryMonth, DiaryWeek } from '@/features/habits/DiaryOverview';
import { HabitDay } from '@/features/habits/HabitDay';
import {
  useHabitCatalog,
  useHabitLogs,
  useHabitScoreEnabled,
  useMyHabits,
} from '@/features/habits/useHabits';

// Wie weit die Uebersicht zurueckschaut, unabhaengig vom angezeigten Monat:
// genug fuer die Serie in der Wochenkarte.
const LOOKBACK_DAYS = 120;

export default function TagebuchScreen() {
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <DiaryHeader />

      {loading ? <SkeletonList /> : session ? <DiaryForUser /> : <DiaryTeaser />}
    </ScrollView>
  );
}

/** Ohne Konto: was es gibt, und der Weg zum Konto. */
function DiaryTeaser() {
  const { t } = useTranslation();
  const catalog = useHabitCatalog();

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('diary.login.title')}</Text>
        <Text style={styles.text}>{t('diary.login.text')}</Text>
        <Link href="/konto" style={styles.link}>
          {t('diary.login.action')}
        </Link>
      </View>
      <QueryBoundary query={catalog}>
        {({ templates }) => (
          <View {...responsive('habits-grid')} style={styles.grid}>
            {templates.map((tpl) => (
              <View key={tpl.id} style={[styles.card, styles.gridCard]}>
                <Text style={styles.cardTitle}>{tpl.title}</Text>
                {tpl.description_md ? <Text style={styles.text}>{tpl.description_md}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </QueryBoundary>
    </View>
  );
}

/**
 * Angemeldet: erst die Einwilligung, dann das Tagebuch.
 *
 * Wer widerrufen hat, sieht sein Tagebuch weiter - lesen und loeschen bleiben
 * erlaubt (SAD §3.10) - und darueber die Einwilligung, falls er wieder
 * eintragen moechte.
 */
function DiaryForUser() {
  const { t } = useTranslation();
  const consents = useConsents();

  return (
    <QueryBoundary query={consents}>
      {(list) => {
        const health = list.find((c) => c.definition.kind === 'health_data');

        // Unveroeffentlicht: niemand kann einwilligen, also auch nicht eintragen.
        if (!health) {
          return <StateMessage title={t('diary.soon.title')} body={t('diary.soon.text')} />;
        }
        if (!health.granted && !health.latest) return <DiaryConsent definition={health.definition} />;

        return (
          <View style={styles.stack}>
            {!health.granted ? <DiaryConsent definition={health.definition} /> : null}
            <DiaryContent />
          </View>
        );
      }}
    </QueryBoundary>
  );
}

function DiaryContent() {
  const today = heute();
  const [date, setDate] = useState<IsoDate>(today);
  const [month, setMonth] = useState<IsoDate>(today);
  const { scoreOn } = useHabitScoreEnabled();

  // Die Serie in der Wochenkarte braucht etwas Vorlauf, der Kalender seinen
  // Monat, die Tagesliste ihren Tag. Score, Verlaeufe und alles Weitere
  // rechnet die Auswertungsseite mit eigener Abfrage (30.10.2026).
  const monthRange = monthDays(month);
  const from = [monthRange[0], addDays(today, -LOOKBACK_DAYS), date].sort()[0];
  const to = [monthRange[monthRange.length - 1], today].sort()[1];

  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const plus = usePlusAccess();
  const logs = useHabitLogs(from, to);

  return (
    <QueryBoundary query={catalog}>
      {({ categories }) => (
        <QueryBoundary query={myHabits}>
          {(habits) => (
            <QueryBoundary query={plus}>
              {(plusAccess) => (
                <QueryBoundary query={logs}>
                  {(entries) => {
                    const active = habits.filter((h) => h.is_active);
                    return (
                      // Reihenfolge nach Wunsch vom 30.10.2026: die Woche
                      // zuerst, dann der Tag, darunter der Monat.
                      <View style={styles.stack}>
                        <DiaryWeek today={today} logs={entries} activeCount={active.length} />

                        <HabitDay
                          date={date}
                          today={today}
                          onChangeDate={(d) => setDate(d > today ? today : d)}
                          habits={active}
                          logs={entries}
                          categories={categories}
                          plusAccess={plusAccess}
                          scoreOn={scoreOn}
                        />

                        <DiaryMonth
                          today={today}
                          month={month}
                          onChangeMonth={setMonth}
                          logs={entries}
                          activeCount={active.length}
                        />
                      </View>
                    );
                  }}
                </QueryBoundary>
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
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
    // Volle Breite wie die Sessions (26.10.2026) - die Karten darunter
    // verteilen sich ueber habits-grid auf mehrere Spalten.
    width: '100%',
  },
  stack: {
    gap: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  // Mobil eine Karte je Reihe, breiter mehrere (habits-grid).
  gridCard: {
    flexBasis: '100%',
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
