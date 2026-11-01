// Der Plan einer Challenge (Migration 0036): aus der Regel je Habit werden
// Termine, aus Terminen und Tagebuch-Eintraegen der Fortschritt.
//
// Eine Regel kombiniert frei (Entscheidung des Users vom 01.11.2026):
//   daily     jeden Tag der Challenge
//   weekdays  feste Wochentage, ISO: 1 = Montag ... 7 = Sonntag
//   dates     bestimmte Tage
//   blocks    mehrtaegige Bloecke ("3 Tage Fasten"), einmal am Ende abgehakt
//
// Termine sind die Wahrheit fuer Kalender und Auswertung; die Datenbank
// haelt vergangene fest (0036). Die Regel bleibt nur fuer den Editor stehen.
//
// Erfuellt ist ein Termin, wenn es im Tagebuch einen Eintrag dazu gibt - fuer
// einen Block irgendwo in seinem Zeitraum, fuer einen Tag genau an ihm. Ein
// Zahlen-Habit mit Wertgrenzen zaehlt erst ab der Plus-Grenze (valuePoints.ts).

import { addDays, weekdayIndex, type IsoDate } from '@/features/habits/dates';
import { meetsGoal, type ValueRule } from '@/features/habits/valuePoints';

export type Block<T> = { start: T; length: number };

/** Plan einer Challenge, mit Kalendertagen. */
export type ChallengePlan = {
  daily?: boolean;
  weekdays?: number[];
  dates?: IsoDate[];
  blocks?: Block<IsoDate>[];
};

/** Plan einer Vorlage der Redaktion, relativ zum Starttag (Tag 0). */
export type TemplatePlan = {
  daily?: boolean;
  weekdays?: number[];
  days?: number[];
  blocks?: Block<number>[];
};

export type PlannedSlot = { startsOn: IsoDate; dueOn: IsoDate };

/** Laengster Block, wie in der Datenbank (due_on - starts_on < 31). */
export const MAX_BLOCK_DAYS = 31;
/** Laengste Challenge, wie in der Datenbank (ends_on - starts_on < 365). */
export const MAX_CHALLENGE_DAYS = 365;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && ISO_DATE.test(value);
}

function intIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Tage von a bis b, beide eingeschlossen (a <= b). */
export function daysBetween(a: IsoDate, b: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) days.push(d);
  return days;
}

/** ISO-Wochentag, 1 = Montag. */
export function isoWeekday(iso: IsoDate): number {
  return weekdayIndex(iso) + 1;
}

/**
 * Ein Plan aus der Datenbank (jsonb, auch von Hand in Studio gepflegt) als
 * sauberer Plan. Was nicht passt, faellt weg - lieber ein Termin zu wenig als
 * ein Absturz.
 */
export function parsePlan(raw: unknown): ChallengePlan {
  const plan: ChallengePlan = {};
  if (!raw || typeof raw !== 'object') return plan;
  const r = raw as Record<string, unknown>;
  if (r.daily === true) plan.daily = true;
  if (Array.isArray(r.weekdays)) {
    const days = [...new Set(r.weekdays.filter((d) => intIn(d, 1, 7)))].sort();
    if (days.length) plan.weekdays = days;
  }
  if (Array.isArray(r.dates)) {
    const dates = [...new Set(r.dates.filter(isIsoDate))].sort();
    if (dates.length) plan.dates = dates;
  }
  if (Array.isArray(r.blocks)) {
    const blocks = r.blocks
      .filter(
        (b): b is Block<IsoDate> =>
          !!b && isIsoDate((b as Block<unknown>).start) && intIn((b as Block<unknown>).length, 1, MAX_BLOCK_DAYS),
      )
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    if (blocks.length) plan.blocks = blocks;
  }
  return plan;
}

/** Wie parsePlan, fuer den relativen Plan einer Vorlage. */
export function parseTemplatePlan(raw: unknown): TemplatePlan {
  const plan: TemplatePlan = {};
  if (!raw || typeof raw !== 'object') return plan;
  const r = raw as Record<string, unknown>;
  if (r.daily === true) plan.daily = true;
  if (Array.isArray(r.weekdays)) {
    const days = [...new Set(r.weekdays.filter((d) => intIn(d, 1, 7)))].sort();
    if (days.length) plan.weekdays = days;
  }
  if (Array.isArray(r.days)) {
    const days = [...new Set(r.days.filter((d) => intIn(d, 0, MAX_CHALLENGE_DAYS)))].sort((a, b) => a - b);
    if (days.length) plan.days = days;
  }
  if (Array.isArray(r.blocks)) {
    const blocks = r.blocks.filter(
      (b): b is Block<number> =>
        !!b &&
        intIn((b as Block<unknown>).start, 0, MAX_CHALLENGE_DAYS) &&
        intIn((b as Block<unknown>).length, 1, MAX_BLOCK_DAYS),
    );
    if (blocks.length) plan.blocks = blocks;
  }
  return plan;
}

/** Den relativen Plan einer Vorlage auf einen Starttag legen. */
export function templatePlanToPlan(plan: TemplatePlan, startsOn: IsoDate): ChallengePlan {
  const result: ChallengePlan = {};
  if (plan.daily) result.daily = true;
  if (plan.weekdays?.length) result.weekdays = [...plan.weekdays];
  if (plan.days?.length) result.dates = plan.days.map((d) => addDays(startsOn, d));
  if (plan.blocks?.length)
    result.blocks = plan.blocks.map((b) => ({
      start: addDays(startsOn, b.start),
      length: b.length,
    }));
  return result;
}

export function isEmptyPlan(plan: ChallengePlan): boolean {
  return !plan.daily && !plan.weekdays?.length && !plan.dates?.length && !plan.blocks?.length;
}

/**
 * Die Termine eines Plans innerhalb der Challenge, nach Datum sortiert.
 *
 * - Bloecke zuerst. Ein Block, der ueber das Ende hinausreicht, endet am
 *   letzten Tag; einer, der einen frueheren ueberlappt, faellt weg.
 * - Einzelne Tage (jeden Tag, Wochentage, Daten) an einem Tag, den schon ein
 *   Block abdeckt, fallen weg - das Habit ist dort ohnehin geplant.
 * - Je Tag hoechstens ein Termin (die Datenbank verlangt das ebenso).
 */
export function expandPlan(plan: ChallengePlan, startsOn: IsoDate, endsOn: IsoDate): PlannedSlot[] {
  if (endsOn < startsOn) return [];
  const slots: PlannedSlot[] = [];
  const covered = new Set<IsoDate>();

  for (const block of plan.blocks ?? []) {
    if (block.start < startsOn || block.start > endsOn) continue;
    const last = addDays(block.start, Math.min(block.length, MAX_BLOCK_DAYS) - 1);
    const dueOn = last > endsOn ? endsOn : last;
    const days = daysBetween(block.start, dueOn);
    if (days.some((d) => covered.has(d))) continue;
    days.forEach((d) => covered.add(d));
    slots.push({ startsOn: block.start, dueOn });
  }

  const weekdays = new Set(plan.weekdays ?? []);
  const dates = new Set(plan.dates ?? []);
  for (const day of daysBetween(startsOn, endsOn)) {
    if (covered.has(day)) continue;
    if (plan.daily || weekdays.has(isoWeekday(day)) || dates.has(day)) {
      slots.push({ startsOn: day, dueOn: day });
      covered.add(day);
    }
  }

  return slots.sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
}

export type SlotStatus = 'done' | 'missed' | 'open';

/** Ein Tagebuch-Eintrag, soweit er fuer Challenges zaehlt. */
export type ChallengeEntry = { date: IsoDate; value: number | null };

/**
 * Stand eines Termins. Offen ist er bis einschliesslich seines Tages - wer
 * erst abends eintraegt, hat ihn nicht verpasst.
 */
export function slotStatus(slot: PlannedSlot, entries: ChallengeEntry[], rule: ValueRule, today: IsoDate): SlotStatus {
  const hit = entries.some((e) => e.date >= slot.startsOn && e.date <= slot.dueOn && meetsGoal(rule, e.value));
  if (hit) return 'done';
  return slot.dueOn < today ? 'missed' : 'open';
}

export type Progress = {
  planned: number;
  done: number;
  missed: number;
  open: number;
  /** Erfuellt von allen geplanten Terminen, 0 bis 100. */
  percent: number;
};

export function progressOf(statuses: SlotStatus[]): Progress {
  const done = statuses.filter((s) => s === 'done').length;
  const missed = statuses.filter((s) => s === 'missed').length;
  const open = statuses.length - done - missed;
  return {
    planned: statuses.length,
    done,
    missed,
    open,
    percent: statuses.length === 0 ? 0 : Math.round((done / statuses.length) * 100),
  };
}

export type ChallengePhase = 'upcoming' | 'running' | 'finished' | 'cancelled';

export function phaseOf(
  challenge: {
    starts_on: IsoDate;
    ends_on: IsoDate;
    cancelled_at: string | null;
  },
  today: IsoDate,
): ChallengePhase {
  if (challenge.cancelled_at) return 'cancelled';
  if (today < challenge.starts_on) return 'upcoming';
  if (today > challenge.ends_on) return 'finished';
  return 'running';
}
