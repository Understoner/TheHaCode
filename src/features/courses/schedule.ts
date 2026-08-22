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
