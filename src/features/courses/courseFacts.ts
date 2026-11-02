// Was die Kurse-Seite im Vorschlag "Mondlicht Mobile" aus einem Kurs liest
// (03.11.2026, nur Testsystem). Reine Funktionen, ohne Browser testbar.
//
// Entscheidung: KEINE neue Spalte. Alles steht schon in den Kursdaten, wie
// sie im Studio gepflegt werden:
//   * Art (Online / Vor Ort / Fuer dich): location "Online" bzw. is_pinned
//   * Thema (Balance, Energy, Relax, Funktionale Atmung): aus dem Titel
//   * die einzelnen Abende: die Liste unter "## Termine" im body_md
// Fehlt etwas davon, zeigt die Seite es schlicht nicht - nichts wird erfunden.

const TIME_ZONE = 'Europe/Vienna';

export type CourseKind = 'online' | 'vorort' | 'mass';
export const COURSE_KINDS: CourseKind[] = ['online', 'vorort', 'mass'];

export type CourseTheme = 'balance' | 'energy' | 'relax' | 'funktional';

type KindSource = { is_pinned: boolean; location: string | null };

/** Angeheftet = "Atmung nach Mass" (Anfrage), sonst Online oder Vor Ort. */
export function courseKind(course: KindSource): CourseKind {
  if (course.is_pinned) return 'mass';
  return /\bonline\b/i.test(course.location ?? '') ? 'online' : 'vorort';
}

/** Das Thema der Online-Reihe, gelesen aus dem Titel. Kein Treffer: null. */
export function courseTheme(title: string): CourseTheme | null {
  const t = title.toLowerCase();
  if (t.includes('funktional')) return 'funktional';
  if (t.includes('balance')) return 'balance';
  if (t.includes('energy') || t.includes('energie')) return 'energy';
  if (t.includes('relax')) return 'relax';
  return null;
}

/**
 * Der Titel ohne den Reihen-Vorspann: "DER ATEMCODE – ONLINE: Balance" wird
 * "Balance". Die Reihe steht in der Zeile darueber schon als Etikett.
 */
export function courseShortTitle(title: string): string {
  const short = title.replace(/^\s*der atemcode\s*[–—-]\s*online\s*:\s*/i, '').trim();
  return short.length > 0 ? short : title;
}

// ---------------------------------------------------------------------------
// Datum in Wien
// ---------------------------------------------------------------------------

const partsFormatter = new Intl.DateTimeFormat('de-AT', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const monthLongFormatter = new Intl.DateTimeFormat('de-AT', { timeZone: TIME_ZONE, month: 'long' });

export type CourseCalendar = {
  /** "2026-11" - zum Gruppieren nach Monat. */
  monthKey: string;
  /** "November" (de-AT: "Jänner"). */
  monthLong: string;
  /** "NOV", "JÄN". */
  monthShort: string;
  day: number;
  /** "Mo", "Di". */
  weekday: string;
  /** "19:00". */
  time: string;
};

/** Kalenderblatt eines Termins in Wiener Zeit. Ohne gueltigen Termin: null. */
export function courseCalendar(startsAt: string | null): CourseCalendar | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    partsFormatter.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  const monthLong = monthLongFormatter.format(date);
  return {
    monthKey: `${part('year')}-${part('month')}`,
    monthLong,
    monthShort: monthLong.slice(0, 3).toUpperCase(),
    day: Number(part('day')),
    weekday: part('weekday').replace('.', ''),
    time: `${part('hour')}:${part('minute')}`,
  };
}

// ---------------------------------------------------------------------------
// Langtext: Abschnitte und Abende
// ---------------------------------------------------------------------------

export type CourseSection = { title: string; body: string };

/** Teilt body_md an den "## "-Ueberschriften. Text davor wird "Über den Kurs". */
export function courseSections(bodyMd: string | null, introTitle: string): CourseSection[] {
  if (!bodyMd) return [];
  const sections: CourseSection[] = [];
  let title = introTitle;
  let lines: string[] = [];
  const flush = () => {
    const body = lines.join('\n').trim();
    if (body) sections.push({ title, body });
  };
  for (const line of bodyMd.split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      title = m[1];
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

export type CourseEvenings = {
  /** Die Listenpunkte unter "## Termine", z. B. "Dienstag, 10. November 2026". */
  dates: string[];
  /** "19:00" und "20:30", wenn der Text "von 19:00 bis 20:30" nennt. */
  from: string | null;
  to: string | null;
};

/** Ist der Abschnitt der mit den einzelnen Abenden? */
export function isEveningsSection(section: CourseSection): boolean {
  return /^termine$/i.test(section.title.trim());
}

/**
 * Die einzelnen Abende aus dem Abschnitt "Termine". Erst ab zwei Abenden
 * lohnt die Zeitleiste; sonst null.
 */
export function courseEvenings(sections: CourseSection[]): CourseEvenings | null {
  const section = sections.find(isEveningsSection);
  if (!section) return null;
  const dates = section.body
    .split('\n')
    .map((l) => /^\s*[-*]\s+(.+?)\s*$/.exec(l)?.[1] ?? null)
    .filter((d): d is string => d !== null)
    .map((d) => d.replace(/\*\*/g, ''));
  if (dates.length < 2) return null;
  const range = /(\d{1,2}[:.]\d{2})\s*(?:bis|–|-)\s*(\d{1,2}[:.]\d{2})/.exec(section.body);
  return {
    dates,
    from: range ? range[1].replace('.', ':') : null,
    to: range ? range[2].replace('.', ':') : null,
  };
}

/** Kurzform eines Abends fuer die Zeitleiste: "Dienstag, 10. November 2026" -> "Di, 10. November". */
export function shortEvening(label: string): string {
  const m = /^([A-Za-zÄÖÜäöü]{2})[a-zäöü]*,?\s+(\d{1,2}\.\s*[A-Za-zÄÖÜäöü]+)/.exec(label);
  return m ? `${m[1]}, ${m[2]}` : label;
}
