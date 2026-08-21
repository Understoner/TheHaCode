import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { PressableRing } from '@/components/PressableRing';

type Props = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateMessage({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <PressableRing onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableRing>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: colors.ink700,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
