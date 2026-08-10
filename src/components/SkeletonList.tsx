import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';

type Props = {
  count?: number;
};

export function SkeletonList({ count = 3 }: Props) {
  return (
    <View testID="skeleton-list" style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.bar} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bar: {
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
});
