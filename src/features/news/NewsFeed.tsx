import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { displayFont } from '@/design/responsive';
import { NEWS_CATEGORIES, type NewsCategory } from '@/features/news/categories';
import { isFresh } from '@/features/news/fresh';
import { CategoryGlyph, categoryTone, MoonScene, NewsCover } from '@/features/news/NewsArt';
import { estimateReadingMinutes } from '@/features/news/readingTime';
import { useNewsList, type NewsPost } from '@/features/news/useNewsList';

// Die News im Vorschlag "Mondlicht Mobile" (02.11.2026, nur Testsystem):
// Kategorien als eine wischbare Leiste mit Symbolen, die ganze Karte ist der
// Link, zwei Zeilen Anriss, Lesezeit als Symbol, neue Beitraege mit goldenem
// Punkt. Der erste Beitrag gross mit Mondszene, die weiteren als kompakte
// Zeilen mit Motiv je Kategorie - ohne Fotos (02.11.2026).
//
// Im Livesystem bleibt NewsList.tsx.

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });

type CategoryFilter = NewsCategory | 'all';

const detailHref = (slug: string) => ({ pathname: '/news/[slug]' as const, params: { slug } });

function ClockGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 2" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function NewsFeed() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const query = useNewsList(category === 'all' ? undefined : category);
  const now = useMemo(() => new Date(), []);
  const filters: CategoryFilter[] = ['all', ...NEWS_CATEGORIES];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        accessibilityLabel={t('news.filter.label')}
      >
        {filters.map((value) => {
          const active = value === category;
          return (
            <PressableRing
              key={value}
              onPress={() => setCategory(value)}
              role="button"
              aria-pressed={active}
              style={[styles.chip, active && styles.chipActive]}
            >
              <CategoryGlyph category={value} color={active ? palette.surface : palette.ink700} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {value === 'all' ? t('news.filter.all') : t(`news.categories.${value}`)}
              </Text>
            </PressableRing>
          );
        })}
      </ScrollView>

      <QueryBoundary query={query} empty={{ title: t('news.empty.title'), hint: t('news.empty.hint') }}>
        {(posts) => {
          const [first, ...rest] = posts;
          return (
            <View style={styles.list}>
              {first ? <FeaturedCard post={first} fresh={isFresh(first.published_at, now)} /> : null}
              {rest.length > 0 ? (
                <>
                  <Text role="heading" aria-level={2} style={styles.sectionTitle}>
                    {t('news.moreTitle')}
                  </Text>
                  <View style={styles.rows}>
                    {rest.map((post) => (
                      <PostRow key={post.id} post={post} fresh={isFresh(post.published_at, now)} />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </View>
  );
}

function FreshDot({ size }: { size: number }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t('news.fresh')}
      style={[styles.freshDot, { width: size, height: size }]}
    />
  );
}

function FeaturedCard({ post, fresh }: { post: NewsPost; fresh: boolean }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const tone = categoryTone(post.category, palette);

  return (
    <Link href={detailHref(post.slug)} style={styles.featuredLink}>
      <View style={styles.featured}>
        <View>
          <MoonScene label={post.title} style={styles.featuredCover} />
          <View style={styles.pill}>
            <CategoryGlyph category={post.category} color={tone} size={14} />
            <Text style={[styles.pillText, { color: tone }]}>{t(`news.categories.${post.category}`)}</Text>
          </View>
          {fresh ? (
            <View style={styles.featuredDot}>
              <FreshDot size={10} />
            </View>
          ) : null}
        </View>
        <View style={styles.featuredBody}>
          <Text role="heading" aria-level={2} {...displayFont} style={styles.featuredTitle}>
            {post.title}
          </Text>
          {post.excerpt ? (
            <Text style={styles.excerpt} numberOfLines={2}>
              {post.excerpt}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <ClockGlyph color={palette.ink700} />
              <Text style={styles.meta}>
                {t('news.readingTimeShort', { minutes: estimateReadingMinutes(post.body_md) })}
              </Text>
            </View>
            {post.published_at ? (
              <Text style={styles.meta}>{dateFormatter.format(new Date(post.published_at))}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Link>
  );
}

function PostRow({ post, fresh }: { post: NewsPost; fresh: boolean }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const tone = categoryTone(post.category, palette);

  return (
    <Link href={detailHref(post.slug)} style={styles.rowLink}>
      <View style={styles.row}>
        <NewsCover
          category={post.category}
          label={post.title}
          compact
          style={styles.thumb}
        />
        <View style={styles.rowText}>
          <Text style={[styles.rowCategory, { color: tone }]}>{t(`news.categories.${post.category}`)}</Text>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
        {fresh ? <FreshDot size={8} /> : null}
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  chipActive: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink700,
  },
  chipTextActive: {
    color: colors.surface,
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    maxWidth: 720,
    width: '100%',
  },
  featuredLink: {
    display: 'flex',
    flexDirection: 'column',
    textDecorationLine: 'none',
  },
  featured: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  featuredCover: {
    width: '100%',
    height: 210,
  },
  pill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingLeft: 7,
    paddingRight: 10,
    borderRadius: radius.full,
    backgroundColor: colors.overlaySurface,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  featuredDot: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  freshDot: {
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  featuredBody: {
    gap: spacing.sm,
    paddingTop: 14,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  featuredTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '600',
    color: colors.ink900,
  },
  excerpt: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink700,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    fontSize: 12,
    color: colors.ink700,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink900,
  },
  rows: {
    gap: spacing.sm,
  },
  rowLink: {
    display: 'flex',
    flexDirection: 'column',
    textDecorationLine: 'none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowCategory: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.ink900,
  },
});
