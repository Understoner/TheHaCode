// "Neu"-Punkt an News-Beitraegen (02.11.2026, nur Testsystem).
//
// Der Vorschlag hatte "ungelesen". Das hiesse festhalten, was jemand gelesen
// hat - im Profil eine neue Tabelle, im Geraet localStorage (fuer fachliche
// Daten verboten, CLAUDE.md). "Neu" braucht nichts davon: ein Beitrag der
// letzten 14 Tage bekommt den Punkt.

export const FRESH_DAYS = 14;

export function isFresh(publishedAt: string | null, now: Date): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return false;
  const age = now.getTime() - published;
  return age >= 0 && age < FRESH_DAYS * 86_400_000;
}
