// Reine Rechnungen fuer Onlinekurse (V1.2) - ohne Netz, ohne React.
//
// Hier steht NICHTS, was ueber Zugang entscheidet: das tut allein
// can_open_course() in der Datenbank. Diese Funktionen bereiten nur auf, was
// die Datenbank schon freigegeben hat (Gliederung, eigener Fortschritt), und
// rechnen Anzeigewerte. Der Preis, den Stripe einzieht, entsteht im Server
// (create-online-course-checkout) - der hier ist nur die Ankuendigung.

export type BlockKind = 'video' | 'audio' | 'text' | 'pdf' | 'quiz';
export type CourseAccess = 'public' | 'account' | 'plus' | 'paid';

export type OutlineBlock = {
  id: string;
  kind: BlockKind;
  title: string;
  day_offset: number;
  sort_order: number;
  duration_sec: number | null;
};

/** Muss zu PLUS_DISCOUNT_PERCENT in supabase/functions/_shared/online-courses.ts passen. */
export const PLUS_DISCOUNT_PERCENT = 15;

/** Bloecke in der Reihenfolge der Redaktion: erst Tag, dann sort_order. */
export function orderBlocks<T extends Pick<OutlineBlock, 'day_offset' | 'sort_order'>>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => a.day_offset - b.day_offset || a.sort_order - b.sort_order);
}

/** Wochen fuer den Zeitverlauf: Tag 1-7 = Woche 1 usw. */
export function groupByWeek<T extends Pick<OutlineBlock, 'day_offset' | 'sort_order'>>(
  blocks: T[],
): { week: number; blocks: T[] }[] {
  const weeks = new Map<number, T[]>();
  for (const block of orderBlocks(blocks)) {
    const week = Math.floor(block.day_offset / 7) + 1;
    weeks.set(week, [...(weeks.get(week) ?? []), block]);
  }
  return [...weeks.entries()].map(([week, list]) => ({ week, blocks: list }));
}

export type CourseProgress = {
  /** Inhalte ohne Quiz. */
  contentTotal: number;
  contentDone: number;
  quizPassed: boolean;
  /** Alle Inhalte erledigt und Quiz bestanden (Entscheidung 03.11.2026). */
  certificateReady: boolean;
  /** Der erste noch offene Block in Kursreihenfolge, sonst null. */
  next: string | null;
};

export function courseProgress(blocks: OutlineBlock[], doneBlockIds: ReadonlySet<string>): CourseProgress {
  const ordered = orderBlocks(blocks);
  const content = ordered.filter((b) => b.kind !== 'quiz');
  const quiz = ordered.find((b) => b.kind === 'quiz');
  const contentDone = content.filter((b) => doneBlockIds.has(b.id)).length;
  // Das Quiz steht nur in course_progress, wenn submit_quiz() es bestanden
  // eingetragen hat (Migration 0043) - per Klick geht das nicht.
  const quizPassed = quiz ? doneBlockIds.has(quiz.id) : false;
  return {
    contentTotal: content.length,
    contentDone,
    quizPassed,
    certificateReady: content.length > 0 && contentDone === content.length && quizPassed,
    next: ordered.find((b) => !doneBlockIds.has(b.id))?.id ?? null,
  };
}

/** Vorgeschlagene Gesamtdauer in Minuten (aufgerundet), aus den Dauern der Bloecke. */
export function totalMinutes(blocks: Pick<OutlineBlock, 'duration_sec'>[]): number {
  const seconds = blocks.reduce((sum, b) => sum + (b.duration_sec ?? 0), 0);
  return Math.ceil(seconds / 60);
}

/** Der angekuendigte Plus-Preis in Cent - gleich gerundet wie im Server. */
export function plusPriceCents(listPriceCents: number): number {
  return Math.round((listPriceCents * (100 - PLUS_DISCOUNT_PERCENT)) / 100);
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export type AccessRow = { expires_at: string; deleted_at?: string | null };

/** Der laengste noch laufende Kauf, sonst null. */
export function activeUntil(rows: AccessRow[], now: Date = new Date()): Date | null {
  let best: Date | null = null;
  for (const row of rows) {
    if (row.deleted_at) continue;
    const end = new Date(row.expires_at);
    if (end > now && (!best || end > best)) best = end;
  }
  return best;
}
