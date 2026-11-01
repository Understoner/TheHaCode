// Kleine Rechnungen fuer die Startseite (01.11.2026, nur Testsystem).
// Reine Funktionen, damit sie ohne Browser getestet werden koennen.

/** Wie viele Impulse es in common.json gibt (start.impulse.1 ... N). */
export const IMPULSE_COUNT = 14;

/** Tag im Jahr, 1 = 1. Januar, in Ortszeit. */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime();
  return Math.round(diff / 86_400_000) + 1;
}

/** Jeden Tag ein anderer Impuls, im ganzen Jahr derselbe Kreislauf. */
export function impulseIndex(date: Date): number {
  return ((dayOfYear(date) - 1) % IMPULSE_COUNT) + 1;
}

export type DayTime = 'morning' | 'day' | 'evening';

export function dayTime(date: Date): DayTime {
  const h = date.getHours();
  if (h >= 4 && h < 11) return 'morning';
  if (h >= 11 && h < 18) return 'day';
  return 'evening';
}

export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';

// Ein synodischer Monat, gemessen an einem bekannten Neumond
// (6. Januar 2000, 18:14 UTC). Auf einen Tag genau - fuer eine Zeile
// "zunehmender Mond" reicht das, fuer einen Kalender nicht.
const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Alter des Mondes in Tagen, 0 bis unter 29,53. */
export function moonAge(date: Date): number {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
}

export function moonPhase(date: Date): MoonPhase {
  const age = moonAge(date);
  if (age < 1.5 || age >= SYNODIC_DAYS - 1.5) return 'new';
  if (Math.abs(age - SYNODIC_DAYS / 2) < 1.5) return 'full';
  return age < SYNODIC_DAYS / 2 ? 'waxing' : 'waning';
}
