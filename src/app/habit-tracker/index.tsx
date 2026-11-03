import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { PageColumn } from '@/design/PageColumn';
import { responsive } from '@/design/responsive';
import { colors, DESIGN_PREVIEW, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { addDays, monthDays, today as heute, weekStart, type IsoDate } from '@/features/habits/dates';
import { DiaryConsent } from '@/features/habits/DiaryConsent';
import { CourseAgenda } from '@/features/onlinecourses/CourseAgenda';
import { DiaryGuest } from '@/features/habits/DiaryGuest';
import { enabledCategoryIds } from '@/features/habits/habitAreas';
import { DiaryHeader, DiaryHeaderMenu, parseDiaryView, type DiaryView } from '@/features/habits/DiaryHeader';
import { DiaryMonth, DiaryWeek } from '@/features/habits/DiaryOverview';
import { DiaryToday } from '@/features/habits/DiaryToday';
import { HabitDay } from '@/features/habits/HabitDay';
import { InsightsForUser } from '@/features/habits/InsightsForUser';
import {
  useHabitAreas,
  useHabitCatalog,
  useHabitLogs,
  useHabitScoreEnabled,
  useMyHabits,
} from '@/features/habits/useHabits';

export default function TagebuchScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  // Testsystem (02.11.2026): Heute, Woche oder Auswertung - in der Adresse,
  // damit "Zurueck" von einem Tag oder einer Session dieselbe Ansicht zeigt.
  const view = parseDiaryView(useLocalSearchParams<{ ansicht?: string }>().ansicht);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Column>
        {DESIGN_PREVIEW ? (
          <DiaryHeaderMenu
            view={view}
            guest={!loading && !session}
            onChangeView={(v) => router.setParams({ ansicht: v === 'heute' ? '' : v })}
          />
        ) : (
          <DiaryHeader />
        )}
  
        {loading ? (
          <SkeletonList />
        ) : !session ? (
          DESIGN_PREVIEW ? (
            <DiaryGuest />
          ) : (
            <DiaryTeaser />
          )
        ) : DESIGN_PREVIEW && view === 'auswertung' ? (
          // Lesen geht immer, auch nach Widerruf (SAD §3.10) - wie auf
          // /habit-tracker/auswertung ohne Abfrage der Einwilligung.
          <InsightsForUser />
        ) : (
          <>
            {/* Kurstermine (V1.2) stehen neben den Habits und brauchen keine
                Einwilligung - deshalb ausserhalb von DiaryForUser. */}
            {view !== 'auswertung' ? <CourseAgenda /> : null}
            <DiaryForUser view={view} />
          </>
        )}
      </Column>
    </ScrollView>
  );
}

// Im Testsystem steht das Tagebuch in der zentrierten Seitenspalte
// (PageColumn, 02.11.2026), im Livesystem bleibt es wie bisher.
function Column({ children }: { children: ReactNode }) {
  return DESIGN_PREVIEW ? <PageColumn>{children}</PageColumn> : <>{children}</>;
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
function DiaryForUser({ view }: { view: DiaryView }) {
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
            <DiaryContent view={view} />
          </View>
        );
      }}
    </QueryBoundary>
  );
}

function DiaryContent({ view }: { view: DiaryView }) {
  const today = heute();
  const [date, setDate] = useState<IsoDate>(today);
  const [month, setMonth] = useState<IsoDate>(today);
  const [week, setWeek] = useState<IsoDate>(today);
  const { scoreOn } = useHabitScoreEnabled();

  // Die Wochenkarte braucht ihre Woche, der Kalender seinen Monat, die
  // Tagesliste ihren Tag. Score, Verlaeufe und alles Weitere rechnet die
  // Auswertungsseite mit eigener Abfrage (30.10.2026).
  const monthRange = monthDays(month);
  // Testsystem: zwei Wochen zurueck mindestens, fuer den Mini-Verlauf der
  // Zahlen-Habits in der Ansicht "Heute" (DiaryToday.tsx).
  const from = [monthRange[0], weekStart(week), date, ...(DESIGN_PREVIEW ? [addDays(today, -13)] : [])].sort()[0];
  const to = [monthRange[monthRange.length - 1], today].sort()[1];

  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const plus = usePlusAccess();
  const logs = useHabitLogs(from, to);
  const areas = useHabitAreas();

  return (
    <QueryBoundary query={catalog}>
      {({ categories }) => (
        <QueryBoundary query={myHabits}>
          {(habits) => (
            <QueryBoundary query={plus}>
              {(plusAccess) => (
                <QueryBoundary query={logs}>
                  {(allEntries) => (
                    <QueryBoundary query={areas.query}>
                      {(enabledAreas) => {
                        // Nur eingeschaltete Bereiche (0032) - fuer Habits wie fuer
                        // die Eintraege, damit Woche und Monat dazu passen.
                        const shown = enabledCategoryIds(categories, enabledAreas);
                        const active = habits.filter(
                          (h) => h.is_active && shown.has(h.habit_templates.category_id),
                        );
                        const visibleIds = new Set(
                          habits.filter((h) => shown.has(h.habit_templates.category_id)).map((h) => h.id),
                        );
                        const entries = allEntries.filter((l) => visibleIds.has(l.user_habit_id));
                        if (DESIGN_PREVIEW && view === 'heute') {
                          return (
                            <DiaryToday
                              today={today}
                              habits={active}
                              allHabits={habits}
                              logs={entries}
                              categories={categories}
                              plusAccess={plusAccess}
                              scoreOn={scoreOn}
                            />
                          );
                        }
                        if (DESIGN_PREVIEW && view === 'woche') {
                          return (
                            <View style={styles.stack}>
                              <DiaryWeek
                                today={today}
                                week={week}
                                onChangeWeek={(w) => setWeek(w > today ? today : w)}
                                logs={entries}
                                activeCount={active.length}
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
                        }
                        return (
                          // Reihenfolge nach Wunsch vom 30.10.2026: die Woche
                          // zuerst, dann der Tag, darunter der Monat.
                          <View style={styles.stack}>
                            <DiaryWeek
                              today={today}
                              week={week}
                              onChangeWeek={(w) => setWeek(w > today ? today : w)}
                              logs={entries}
                              activeCount={active.length}
                            />

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
