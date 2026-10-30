// Habit-Bereiche je Person (30.10.2026, Migration 0032) - rein, ohne Netz.
//
// Gespeichert sind die Slugs der eingeschalteten Kategorien in
// profiles.habit_categories. NULL heisst "alle" (Konten von vor 0032), neue
// Konten starten mit Atmung. Atmung ist IMMER eingeschaltet: das ist der Kern
// der App, und so gibt es nie ein Tagebuch ohne einen einzigen Bereich.

/** Der Bereich, der sich nicht abschalten laesst. */
export const CORE_AREA = 'atmung';

type WithSlug = { id: string; slug: string };

/** Ist dieser Bereich eingeschaltet? */
export function isAreaEnabled(slug: string, enabled: readonly string[] | null): boolean {
  return slug === CORE_AREA || enabled === null || enabled.includes(slug);
}

/** Die IDs der eingeschalteten Kategorien. */
export function enabledCategoryIds(categories: WithSlug[], enabled: readonly string[] | null): Set<string> {
  return new Set(categories.filter((c) => isAreaEnabled(c.slug, enabled)).map((c) => c.id));
}

/**
 * Einen Bereich ein- oder ausschalten. Aus "alle" (NULL) wird dabei eine
 * ausdrueckliche Liste aller uebrigen; der Kernbereich steht immer drin.
 */
export function toggleArea(
  categories: WithSlug[],
  enabled: readonly string[] | null,
  slug: string,
  on: boolean,
): string[] {
  if (slug === CORE_AREA) return withCore(enabled ?? categories.map((c) => c.slug));
  const current = new Set(enabled ?? categories.map((c) => c.slug));
  if (on) current.add(slug);
  else current.delete(slug);
  return withCore([...current]);
}

function withCore(slugs: readonly string[]): string[] {
  return [CORE_AREA, ...slugs.filter((s) => s !== CORE_AREA)];
}
