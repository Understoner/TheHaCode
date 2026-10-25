import { fromIsoDate, type IsoDate } from './dates';

// Anzeige von Kalendertagen. Intl statt einer Bibliothek (CLAUDE.md), in der
// oesterreichischen Schreibweise wie im Rest der App ("Jänner").

const dayFormat = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});

const monthFormat = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' });

const shortFormat = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'numeric' });

export function formatDay(iso: IsoDate): string {
  return dayFormat.format(fromIsoDate(iso));
}

export function formatMonth(iso: IsoDate): string {
  return monthFormat.format(fromIsoDate(iso));
}

export function formatShort(iso: IsoDate): string {
  return shortFormat.format(fromIsoDate(iso));
}
