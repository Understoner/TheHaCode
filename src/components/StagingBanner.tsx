import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';

export function StagingBanner() {
  const { t } = useTranslation();

  if (process.env.EXPO_PUBLIC_APP_ENV !== 'staging') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('common.stagingBanner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.warningSurface,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink700,
  },
});
