// Termine von Kursen, wie sie in Oesterreich gelesen werden.
//
// Zwei Festlegungen, beide bewusst:
//
// 1. Sprache de-AT, nicht de-DE wie bei den News. Ein Kurs im Jaenner heisst
//    hier Jaenner, und das Publikum sitzt in Oberoesterreich.
// 2. Zeitzone fest auf Europe/Vienna. Der Kursabend beginnt um 19:00 im
//    Kursraum - unabhaengig davon, wo der Besucher gerade sitzt. Ohne diese
//    Angabe rechnete der Browser die Zeit in seine eigene Zone um, und ein
//    Leser in Lissabon laese 18:00.
const TIME_ZONE = 'Europe/Vienna';

const listFormatter = new Intl.DateTimeFormat('de-AT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const detailFormatter = new Intl.DateTimeFormat('de-AT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** Kurzform fuer die Kachel: "13. Oktober 2026". Ohne Termin: null. */
export function formatCourseDate(startsAt: string | null): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? null : listFormatter.format(date);
}

/** Langform fuer die Detailseite: "Dienstag, 13. Oktober 2026, 19:00". */
export function formatCourseStart(startsAt: string | null): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? null : detailFormatter.format(date);
}

// Der Kalendertag in Wien als "YYYY-MM-DD". en-CA liefert genau diese Form,
// und in dieser Form laesst sich Datum als Zeichenkette vergleichen - ohne
// eine einzige Zeile Zeitzonenrechnung. Das ist der Grund fuer die
// ungewoehnliche Sprachwahl: es geht nicht um Kanada, es geht um das Format.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
});

/** Der Kalendertag in Wien, zu dem dieser Zeitpunkt gehoert. */
export function courseDay(date: Date): string {
  return dayFormatter.format(date);
}

/**
 * Liegt der Kurstermin vor dem heutigen Tag?
 *
 * Der Schnitt liegt am TAG, nicht an der Uhrzeit: ein Abend um 20:00 bleibt
 * den ganzen Tag ueber sichtbar und verschwindet erst am naechsten Morgen.
 * Waere die Uhrzeit massgeblich, fiele der Kurs um 20:01 aus der Liste -
 * waehrend er gerade laeuft und jemand die Seite offen hat.
 *
 * Massgeblich ist Wien, nicht die Zone des Besuchers - dieselbe Festlegung
 * wie bei der Anzeige oben. Sonst sieht ein Leser in Lissabon einen Kurs
 * schon verschwinden, waehrend er in Oberoesterreich noch bevorsteht.
 *
 * Ein Kurs OHNE Termin gilt nie als vergangen. Er hat kein Datum, an dem man
 * ihn messen koennte, und still zu verschwinden waere das Schlechteste, was
 * eine redaktionell gepflegte Zeile tun kann.
 */
export function isPastCourse(startsAt: string | null, now: Date = new Date()): boolean {
  if (!startsAt) return false;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return false;
  return courseDay(date) < courseDay(now);
}
