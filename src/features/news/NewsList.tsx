import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, spacing } from '@/design/tokens';
import { useNewsList } from '@/features/news/useNewsList';

export function NewsList() {
  const { t } = useTranslation();
  const query = useNewsList();

  return (
    <QueryBoundary query={query} empty={{ title: t('news.empty.title'), hint: t('news.empty.hint') }}>
      {(posts) => (
        <View style={styles.container}>
          {posts.map((post) => (
            <View key={post.id} style={styles.item}>
              <Text style={styles.title}>{post.title}</Text>
              {post.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}
            </View>
          ))}
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
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
