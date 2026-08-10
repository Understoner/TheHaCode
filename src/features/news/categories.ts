import { colors } from '@/design/tokens';
import type { Database } from '@/types/database';

export type NewsCategory = Database['public']['Enums']['news_category'];

export const NEWS_CATEGORIES: NewsCategory[] = ['praxis', 'blog', 'kurs', 'allgemein'];

// Nur zwei Akzentfamilien in den Tokens (ocean/sage) fuer vier Kategorien -
// "allgemein" bleibt deshalb bewusst farblos (ink700/surfaceSubtle): die
// neutralste Kategorie bekommt keinen Akzent statt einen doppelt vergebenen.
type Tone = 'ocean' | 'sage' | 'neutral';

const NEWS_CATEGORY_TONE: Record<NewsCategory, Tone> = {
  kurs: 'ocean',
  praxis: 'sage',
  blog: 'sage',
  allgemein: 'neutral',
};

export function newsCategoryColors(category: NewsCategory): { text: string; tint: string } {
  const tone = NEWS_CATEGORY_TONE[category];
  if (tone === 'ocean') return { text: colors.ocean700, tint: colors.oceanTint };
  if (tone === 'sage') return { text: colors.sage700, tint: colors.sageTint };
  return { text: colors.ink700, tint: colors.surfaceSubtle };
}
