import { QueryBoundary } from '@/components/QueryBoundary';
import { DESIGN_PREVIEW } from '@/design/tokens';

import { addDays, today as heute } from './dates';
import { DiaryInsights } from './DiaryInsights';
import { DiaryJourney } from './DiaryJourney';
import { useHabitCatalog, useHabitLogs, useHabitScoreEnabled, useMyHabits, useMySessions } from './useHabits';

// Genug fuer BOLT-Verlauf und den Vergleich zweier 4-Wochen-Zeitraeume.
const LOOKBACK_DAYS = 120;

/**
 * Die Auswertung mit ihren Abfragen - auf /habit-tracker/auswertung und im
 * Testsystem (02.11.2026) als dritte Ansicht des Tagebuchs.
 */
export function InsightsForUser() {
  const today = heute();
  // Ab dem 1. Jaenner, weil der Score auch das Jahr zeigt (score.ts).
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const from = [addDays(today, -LOOKBACK_DAYS), yearStart].sort()[0];

  const { scoreOn } = useHabitScoreEnabled();
  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const logs = useHabitLogs(from, today);
  const sessions = useMySessions();

  return (
    <QueryBoundary query={catalog}>
      {({ categories }) => (
        <QueryBoundary query={myHabits}>
          {(habits) => (
            <QueryBoundary query={logs}>
              {(entries) => (
                <QueryBoundary query={sessions}>
                  {(sessionList) => {
                    // Im Testsystem die Auswertung als Erlebnis (DiaryJourney, 02.11.2026).
                    const View = DESIGN_PREVIEW ? DiaryJourney : DiaryInsights;
                    return (
                    <View
                      today={today}
                      habits={habits}
                      logs={entries}
                      sessions={sessionList}
                      categories={categories}
                      scoreOn={scoreOn}
                    />
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
