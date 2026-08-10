import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useNewsList } from '@/features/news/useNewsList';
import { supabase } from '@/lib/supabase';

export function NewsList() {
  const { t } = useTranslation();
  const query = useNewsList();

  return (
    <QueryBoundary query={query} empty={{ title: t('news.empty.title'), hint: t('news.empty.hint') }}>
      {(posts) => (
        <View style={styles.container}>
          {posts.map((post) => {
            const coverUrl = post.cover_image_path
              ? supabase.storage.from('public-assets').getPublicUrl(post.cover_image_path).data.publicUrl
              : null;

            return (
              <View key={post.id} style={styles.item}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.cover} accessibilityLabel={post.title} />
                ) : null}
                <View style={styles.text}>
                  <Text style={styles.title}>{post.title}</Text>
                  {post.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  cover: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text700,
  },
  excerpt: {
    fontSize: 14,
    color: colors.text700,
  },
});
