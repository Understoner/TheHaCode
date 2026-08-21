import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { Markdown } from '@/features/news/Markdown';
import { newsCategoryColors } from '@/features/news/categories';
import { estimateReadingMinutes } from '@/features/news/readingTime';
import { useNewsPost } from '@/features/news/useNewsPost';
import type { NewsPost } from '@/features/news/useNewsList';

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Die Detailseite zu einem News-Beitrag.
//
// Bis hierher zeigte die Startseite Titel und Anriss, und body_md wurde
// geschrieben, aber nie gelesen. Genau das war der Grund, die Seite zu bauen:
// ein Pflichtfeld, das niemand sieht, ist eine Einladung, es schlecht zu
// pflegen.
export default function NewsDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useNewsPost(slug);

  return (
    <QueryBoundary query={query}>
      {(post) => (post ? <Article post={post} /> : <NotFound />)}
    </QueryBoundary>
  );
}

function NotFound() {
  const { t } = useTranslation();

  return (
    <View style={styles.notFound}>
      <StateMessage title={t('news.detail.notFound.title')} body={t('news.detail.notFound.hint')} />
      <Link href="/" style={styles.back}>
        {t('news.detail.back')}
      </Link>
    </View>
  );
}

function Article({ post }: { post: NewsPost }) {
  const { t } = useTranslation();
  const tone = newsCategoryColors(post.category);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/" style={styles.back}>
        {t('news.detail.back')}
      </Link>

      <CoverImage path={post.cover_image_path} label={post.title} tone="ocean" style={styles.cover} />

      <View style={styles.meta}>
        <Text style={[styles.category, { color: tone.text }]}>
          {t(`news.categories.${post.category}`)}
        </Text>
        <Text style={styles.metaText}>
          {post.published_at ? dateFormatter.format(new Date(post.published_at)) : ''}
          {post.published_at ? ' · ' : ''}
          {t('news.readingTime', { minutes: estimateReadingMinutes(post.body_md) })}
        </Text>
      </View>

      <Text style={styles.title} role="heading" aria-level={1}>
        {post.title}
      </Text>

      {/* Der Anriss steht auch hier, als Vorspann - er ist der Satz, mit dem
          der Beitrag auf der Startseite geworben hat, und wer geklickt hat,
          sucht ihn zuerst. */}
      {post.excerpt ? <Text style={styles.lead}>{post.excerpt}</Text> : null}

      <View style={styles.rule} />

      <Markdown source={post.body_md} />

      <View style={styles.rule} />

      <Link href="/" style={styles.back}>
        {t('news.detail.back')}
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    // Fliesstext braucht eine Zeilenlaenge, die man lesen kann - auf einem
    // breiten Bildschirm sind das nicht 1400 Pixel.
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  notFound: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  back: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ocean700,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaText: {
    fontSize: 13,
    color: colors.ink700,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600',
    color: colors.ink900,
  },
  lead: {
    fontSize: 18,
    lineHeight: 30,
    color: colors.ink700,
  },
  rule: {
    height: 1,
    backgroundColor: colors.line,
  },
});
