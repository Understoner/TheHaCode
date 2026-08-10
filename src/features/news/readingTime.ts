const WORDS_PER_MINUTE = 200;

// Schaetzt die Lesezeit aus echtem body_md - keine erfundene Angabe.
export function estimateReadingMinutes(bodyMd: string): number {
  const wordCount = bodyMd.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
