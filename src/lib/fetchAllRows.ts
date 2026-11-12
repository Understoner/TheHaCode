// Alle Zeilen einer Abfrage holen - seitenweise.
//
// WARUM ES DAS BRAUCHT (Review 11.11.2026, E1)
// --------------------------------------------
// PostgREST liefert je Anfrage hoechstens max_rows Zeilen (supabase/config.toml,
// in der Cloud derselbe Standardwert: 1000) und meldet das Abschneiden NICHT
// als Fehler. Eine Abfrage ohne Blaettern sieht deshalb bis zur 1000. Zeile
// richtig aus und verliert danach still Daten. Getroffen hat das:
//
//   * die Datenauskunft nach Art. 15 und 20 DSGVO - und damit die "Kopie vor
//     dem Loeschen" beim Widerruf der Tagebuch-Einwilligung,
//   * die Auswertung: aufsteigend sortiert fehlten ausgerechnet die neuesten
//     Eintraege, der Score der laufenden Woche fiel auf null,
//   * die Termine der Uebungswege.
//
// Wer acht Habits am Tag fuehrt, ist nach gut vier Monaten ueber der Grenze.
//
// WIE DAS ENDE ERKANNT WIRD
// -------------------------
// Nicht an "die Seite war kuerzer als bestellt": stellt jemand max_rows am
// Server kleiner als PAGE_SIZE, waere jede Seite kuerzer als bestellt und die
// Schleife hoerte nach der ersten auf - derselbe stille Verlust in neuem
// Gewand. Deshalb:
//
//   * nennt der Server die Gesamtzahl (select mit { count: 'exact' }), ist
//     fertig, sobald so viele Zeilen da sind - im Normalfall nach EINER
//     Anfrage,
//   * sonst erst, wenn eine Seite leer zurueckkommt.
//
// WAS DER AUFRUFER MITBRINGEN MUSS
// --------------------------------
// Eine eindeutige Sortierung (am Ende immer .order('id')). Ohne sie darf die
// Datenbank die Zeilen von Seite zu Seite anders reihen, und es fehlen welche
// oder kommen doppelt.

export const PAGE_SIZE = 1000;

type Page<T> = { data: T[] | null; error: unknown; count?: number | null };

/**
 * Ruft fetchPage(from, to) so oft auf, bis alle Zeilen da sind. Ein Fehler
 * bricht ab und wird geworfen - eine halbe Antwort gibt es nicht.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];

  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    // Eine leere Seite ist immer das Ende - auch als Schutz vor einer
    // Endlosschleife, falls die Gesamtzahl groesser gemeldet wird, als Zeilen
    // kommen (zwischen zwei Seiten geloescht).
    if (page.length === 0) return rows;
    if (typeof count === 'number' && rows.length >= count) return rows;
  }
}
