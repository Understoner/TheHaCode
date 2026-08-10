import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useNewsList } from '@/features/news/useNewsList';
import { estimateReadingMinutes } from '@/features/news/readingTime';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

export function NewsList() {
  const { t } = useTranslation();
  const query = useNewsList();

  return (
    <QueryBoundary query={query} empty={{ title: t('news.empty.title'), hint: t('news.empty.hint') }}>
      {(posts) => {
        const pinned = posts.filter((p) => p.is_pinned);
        const rest = posts.filter((p) => !p.is_pinned);

        return (
          <View style={styles.container}>
            {pinned.length > 0 ? (
              <View style={styles.heroRow}>
                {pinned.map((post, i) => (
                  <View key={post.id} style={styles.heroCard}>
                    <CoverImage
                      path={post.cover_image_path}
                      label={post.title}
                      tone={i % 2 === 0 ? 'ocean' : 'sage'}
                      style={styles.heroCover}
                    />
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
            ) : null}

            {rest.length > 0 ? (
              <View style={styles.listSection}>
                {pinned.length > 0 ? <Text style={styles.listHeading}>{t('news.moreTitle')}</Text> : null}
                <View style={styles.list}>
                  {rest.map((post) => (
                    <View key={post.id} style={styles.listRow}>
                      <CoverImage
                        path={post.cover_image_path}
                        label={post.title}
                        tone="sage"
                        style={styles.listCover}
                      />
                      <View style={styles.listText}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  heroCard: {
    flexGrow: 1,
    flexBasis: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  heroCover: {
    width: '100%',
    aspectRatio: 16 / 9,
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
  listSection: {
    gap: spacing.md,
  },
  listHeading: {
    fontSize: 14,
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
  listText: {
    flex: 1,
    gap: 4,
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
