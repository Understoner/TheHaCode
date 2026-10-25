// Was die Datenbank beim Eintragen ablehnt, in einen Satz fuer Menschen
// (CLAUDE.md: deutsch, ohne Technikjargon, mit Handlungsoption). Die Codes
// kommen aus Migration 0021 und RLS.

type MaybePgError = { code?: string; message?: string } | null | undefined;

export function diaryErrorKey(error: unknown): string {
  const code = (error as MaybePgError)?.code;
  const message = (error as MaybePgError)?.message ?? '';

  // RLS: keine Einwilligung oder kein Plus fuer dieses Habit.
  if (code === '42501') return 'errors:diary.forbidden';
  if (code === '23514') {
    return message.includes('Zukunft') ? 'errors:diary.future' : 'errors:diary.range';
  }
  return 'errors:diary.save';
}
