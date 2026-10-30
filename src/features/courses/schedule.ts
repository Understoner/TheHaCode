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

// ---------------------------------------------------------------------------
// Filter nach Zeitraum (30.10.2026)
// ---------------------------------------------------------------------------
// Die Kursliste laesst sich auf einer eigenen Filterseite nach Zeitraum
// eingrenzen. Gerechnet wird in Wiener Kalendertagen wie oben, die Tage als
// 'YYYY-MM-DD' - Vergleiche sind damit reine Zeichenvergleiche.
//
// Kurse OHNE Termin (z. B. das angeheftete Anfrage-Angebot) bleiben in jedem
// Zeitraum sichtbar: sie lassen sich jederzeit anfragen und fielen sonst
// genau dann weg, wenn jemand "bald" sucht.

export const COURSE_PERIODS = ['alle', 'woche', 'monat', 'naechsterMonat', 'dreiMonate'] as const;
export type CoursePeriod = (typeof COURSE_PERIODS)[number];

export function parseCoursePeriod(raw: string | string[] | undefined): CoursePeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (COURSE_PERIODS as readonly string[]).includes(value ?? '') ? (value as CoursePeriod) : 'alle';
}

function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function monthStart(day: string, months: number): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
}

/** Erster und letzter Tag des Zeitraums, beide eingeschlossen. */
export function periodRange(period: CoursePeriod, now: Date = new Date()): [string, string] | null {
  const today = courseDay(now);
  switch (period) {
    case 'alle':
      return null;
    case 'woche': {
      // Bis Sonntag der laufenden Woche (Montag ist Wochenbeginn).
      const [y, m, d] = today.split('-').map(Number);
      const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      return [today, shiftDay(today, 6 - weekday)];
    }
    case 'monat':
      return [today, shiftDay(monthStart(today, 1), -1)];
    case 'naechsterMonat':
      return [monthStart(today, 1), shiftDay(monthStart(today, 2), -1)];
    case 'dreiMonate': {
      // Heute plus drei Kalendermonate, am selben Tag (ohne ihn).
      const [, , d] = today.split('-').map(Number);
      const end = shiftDay(monthStart(today, 3), d - 1);
      return [today, shiftDay(end, -1)];
    }
  }
}

export function isInCoursePeriod(startsAt: string | null, period: CoursePeriod, now: Date = new Date()): boolean {
  const range = periodRange(period, now);
  if (!range || !startsAt) return true;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return true;
  const day = courseDay(date);
  return day >= range[0] && day <= range[1];
}
