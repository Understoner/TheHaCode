// Kalendertage als 'YYYY-MM-DD' - genau so, wie habit_logs.log_date sie
// speichert.
//
// WARUM KEINE BIBLIOTHEK
// ----------------------
// CLAUDE.md verbietet neue Bibliotheken fuer Datumsrechnung. Gebraucht wird
// hier wenig: Tage addieren, den Montag einer Woche finden, die Tage eines
// Monats aufzaehlen. Das geht mit Date, solange zwei Fallen gemieden werden:
//
//   * toISOString() rechnet in UTC. Um 0:30 in Wien waere "heute" dort noch
//     gestern. Deshalb werden Jahr, Monat und Tag aus den ORTSZEIT-Feldern
//     gelesen.
//   * Ein Datum um Mitternacht kippt bei der Zeitumstellung in den Vortag,
//     wenn man 24 Stunden addiert. Deshalb wird intern immer um 12 Uhr
//     gerechnet und ueber setDate() addiert, nie ueber Millisekunden.

export type IsoDate = string;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Der Kalendertag eines Zeitpunkts in der Ortszeit des Geraets. */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Mittag des Tages in Ortszeit - sicher gegen die Zeitumstellung. */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function today(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Montag der ISO-Woche, in der der Tag liegt. */
export function weekStart(iso: IsoDate): IsoDate {
  const date = fromIsoDate(iso);
  // getDay(): Sonntag 0 ... Samstag 6. Abstand zum Montag davor.
  const offset = (date.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

/** Die sieben Tage der Woche ab Montag. */
export function weekDays(iso: IsoDate): IsoDate[] {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Alle Tage des Kalendermonats, in dem der Tag liegt. */
export function monthDays(iso: IsoDate): IsoDate[] {
  const [y, m] = iso.split('-').map(Number);
  // Tag 0 des Folgemonats ist der letzte Tag dieses Monats.
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}

/** 'YYYY-MM' */
export function monthKey(iso: IsoDate): string {
  return iso.slice(0, 7);
}

/** Erster Tag des Vor- oder Folgemonats. */
export function shiftMonth(iso: IsoDate, months: number): IsoDate {
  const [y, m] = iso.split('-').map(Number);
  const date = new Date(y, m - 1 + months, 1, 12);
  return toIsoDate(date);
}

/** Wochentag 0 = Montag ... 6 = Sonntag. */
export function weekdayIndex(iso: IsoDate): number {
  return (fromIsoDate(iso).getDay() + 6) % 7;
}
