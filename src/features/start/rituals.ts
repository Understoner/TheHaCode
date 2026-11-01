// "Deine 3 Rituale" auf der Startseite (01.11.2026, nur Testsystem):
// zuerst die eigenen Favoriten, aufgefuellt mit den uebrigen Sequenzen in der
// Reihenfolge der Redaktion. Ohne Anmeldung sind es die ersten drei.

export const RITUAL_COUNT = 3;

export function pickRituals<T extends { id: string }>(
  exercises: T[],
  favoriteIds: ReadonlySet<string>,
  count = RITUAL_COUNT,
): T[] {
  const favorites = exercises.filter((e) => favoriteIds.has(e.id));
  const rest = exercises.filter((e) => !favoriteIds.has(e.id));
  return [...favorites, ...rest].slice(0, count);
}

/** Minuten fuer die Karte, aufgerundet; ohne Schaetzung keine Angabe. */
export function ritualMinutes(estimatedSeconds: number | null): number | null {
  if (!estimatedSeconds || estimatedSeconds <= 0) return null;
  return Math.max(1, Math.round(estimatedSeconds / 60));
}
