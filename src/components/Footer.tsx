import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';

export function Footer() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Link href="/impressum" style={styles.link}>
        {t('footer.impressum')}
      </Link>
      <Text style={styles.separator}>·</Text>
      <Link href="/datenschutz" style={styles.link}>
        {t('footer.datenschutz')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  link: {
    fontSize: 13,
    color: colors.ink700,
  },
  separator: {
    fontSize: 13,
    color: colors.ink700,
  },
});
