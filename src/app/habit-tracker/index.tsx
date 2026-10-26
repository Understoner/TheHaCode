import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
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
import { DiaryInsights } from '@/features/habits/DiaryInsights';
import { HabitDay } from '@/features/habits/HabitDay';
import {
  useHabitCatalog,
  useHabitLogs,
  useHabitScoreEnabled,
  useMyHabits,
  useMySessions,
} from '@/features/habits/useHabits';

// Wie weit die Auswertung zurueckschaut, unabhaengig vom angezeigten Monat:
// genug fuer Serie und BOLT-Verlauf, wenig genug fuer eine Abfrage.
const LOOKBACK_DAYS = 120;

export default function TagebuchScreen() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('diary.title')}</Text>
      <Text style={styles.intro}>{t('diary.intro')}</Text>

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
  const { t } = useTranslation();
  const today = heute();
  const [date, setDate] = useState<IsoDate>(today);
  const [month, setMonth] = useState<IsoDate>(today);
  const { scoreOn, setScoreOn } = useHabitScoreEnabled();

  const monthRange = monthDays(month);
  // Ab dem 1. Jaenner, weil der Score auch das Jahr zeigt (score.ts).
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const from = [monthRange[0], addDays(today, -LOOKBACK_DAYS), date, yearStart].sort()[0];
  const to = [monthRange[monthRange.length - 1], today].sort()[1];

  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const plus = usePlusAccess();
  const logs = useHabitLogs(from, to);
  const sessions = useMySessions();

  return (
    <View style={styles.stack}>
      {/* Die Auswahl hat eine eigene Seite (25.10.2026) und sitzt gleich
          neben dem Score-Schalter: zwei Einstellungen zum Tagebuch, eine Zeile. */}
      <View style={styles.controls}>
        <PressableRing
          onPress={() => setScoreOn(!scoreOn)}
          role="switch"
          aria-checked={scoreOn}
          style={[styles.toggle, scoreOn && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, scoreOn && styles.toggleTextOn]}>
            {`${t('diary.score.toggle')}: ${scoreOn ? t('diary.score.on') : t('diary.score.off')}`}
          </Text>
        </PressableRing>
        <Link href="/habit-tracker/auswahl" style={[styles.toggle, styles.toggleText]}>
          {t('diary.picker.title')}
        </Link>
      </View>

      <QueryBoundary query={catalog}>
        {({ categories }) => (
          <QueryBoundary query={myHabits}>
            {(habits) => (
              <QueryBoundary query={plus}>
                {(plusAccess) => (
                  <QueryBoundary query={logs}>
                    {(entries) => (
                      <View style={styles.stack}>
                        <HabitDay
                          date={date}
                          today={today}
                          onChangeDate={(d) => setDate(d > today ? today : d)}
                          habits={habits.filter((h) => h.is_active)}
                          logs={entries}
                          categories={categories}
                          plusAccess={plusAccess}
                          scoreOn={scoreOn}
                        />

                        <QueryBoundary query={sessions}>
                          {(sessionList) => (
                            <DiaryInsights
                              today={today}
                              month={month}
                              onChangeMonth={setMonth}
                              habits={habits}
                              logs={entries}
                              sessions={sessionList}
                              categories={categories}
                              scoreOn={scoreOn}
                            />
                          )}
                        </QueryBoundary>
                      </View>
                    )}
                  </QueryBoundary>
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        )}
      </QueryBoundary>
    </View>
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
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  intro: {
    // Fliesstext bleibt lesbar schmal, auch wenn die Seite breit ist.
    maxWidth: 720,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
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
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggle: {
    alignSelf: 'flex-start',
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
