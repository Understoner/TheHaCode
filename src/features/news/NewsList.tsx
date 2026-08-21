import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { RECENT_ITEMS_COUNT } from '@/design/navigation';
import { responsive } from '@/design/responsive';
import { NEWS_CATEGORIES, newsCategoryColors, type NewsCategory } from '@/features/news/categories';
import { useNewsList } from '@/features/news/useNewsList';
import { estimateReadingMinutes } from '@/features/news/readingTime';
import { PressableRing } from '@/components/PressableRing';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

type CategoryFilter = NewsCategory | 'all';

export function NewsList() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const query = useNewsList(category === 'all' ? undefined : category);

  const filters: CategoryFilter[] = ['all', ...NEWS_CATEGORIES];

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {filters.map((value) => {
          const active = value === category;
          const tone = value === 'all' ? null : newsCategoryColors(value);
          return (
            <PressableRing
              key={value}
              onPress={() => setCategory(value)}
              style={[
                styles.filterChip,
                active && (tone ? { backgroundColor: tone.tint, borderColor: tone.text } : styles.filterChipActiveAll),
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && (tone ? { color: tone.text, fontWeight: '600' } : styles.filterChipTextActiveAll),
                ]}
              >
                {value === 'all' ? t('news.filter.all') : t(`news.categories.${value}`)}
              </Text>
            </PressableRing>
          );
        })}
      </View>

      <QueryBoundary query={query} empty={{ title: t('news.empty.title'), hint: t('news.empty.hint') }}>
        {(posts) => {
          const recent = posts.slice(0, RECENT_ITEMS_COUNT);
          const older = posts.slice(RECENT_ITEMS_COUNT);

          return (
            <View style={styles.resultGroup}>
              {recent.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionHeading}>{t('news.recentTitle')}</Text>
                  <View {...responsive('news-grid')} style={styles.heroRow}>
                    {recent.map((post, i) => (
                      <View key={post.id} style={styles.heroCard}>
                        <View style={styles.heroCoverWrap}>
                          <CoverImage
                            path={post.cover_image_path}
                            label={post.title}
                            tone={i % 2 === 0 ? 'ocean' : 'sage'}
                            style={styles.heroCover}
                          />
                          <View style={styles.categoryPill}>
                            <Text style={[styles.categoryPillText, { color: newsCategoryColors(post.category).text }]}>
                              {t(`news.categories.${post.category}`)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.heroBody}>
                          <Text style={styles.meta}>
                            {post.published_at ? dateFormatter.format(new Date(post.published_at)) : ''}
                            {post.published_at ? ' · ' : ''}
                            {t('news.readingTime', { minutes: estimateReadingMinutes(post.body_md) })}
                          </Text>
                          <Text style={styles.heroTitle}>{post.title}</Text>
                          {post.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {older.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionHeading}>{t('news.moreTitle')}</Text>
                  <View style={styles.list}>
                    {older.map((post) => (
                      <View key={post.id} style={styles.listRow}>
                        <CoverImage
                          path={post.cover_image_path}
                          label={post.title}
                          tone="sage"
                          style={styles.listCover}
                        />
                        <View style={styles.listDivider} />
                        <View style={styles.listText}>
                          <Text style={[styles.listCategory, { color: newsCategoryColors(post.category).text }]}>
                            {t(`news.categories.${post.category}`)}
                          </Text>
                          <Text style={styles.listTitle}>{post.title}</Text>
                          <Text style={styles.meta}>
                            {post.published_at ? dateFormatter.format(new Date(post.published_at)) : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  resultGroup: {
    gap: spacing.xl,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  filterChipActiveAll: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  filterChipTextActiveAll: {
    color: colors.surface,
    fontWeight: '600',
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  heroCard: {
    flexGrow: 0,
    flexBasis: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  // Die Desktop-Breite ('news-grid') steht als Media Query in
  // src/design/responsive.ts - siehe dort, warum nicht mehr in JavaScript.
  heroCoverWrap: {
    position: 'relative',
  },
  heroCover: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  // Kategorie-Pill ueber dem Cover, wie ui/references/06_news_desktop.svg
  // (Zeile ~33f.): halbtransparente Flaeche, Grossbuchstaben, Kategoriefarbe.
  categoryPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.overlaySurface,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroBody: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  excerpt: {
    fontSize: 13,
    color: colors.ink700,
  },
  list: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  listCover: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  // Trennlinie zwischen Cover und Text, wie in den Listenzeilen der
  // Referenz (06_news_desktop.svg, z. B. Zeile 83).
  listDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.line,
  },
  listText: {
    flex: 1,
    gap: 4,
  },
  listCategory: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink900,
  },
  meta: {
    fontSize: 11,
    color: colors.ink700,
  },
});
