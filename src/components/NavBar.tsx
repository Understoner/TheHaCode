import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { navItems } from '@/design/navigation';

export function NavBar() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {navItems.map((item) =>
        item.kind === 'link' ? (
          <Link key={item.key} href={item.href} style={styles.link}>
            {t(item.labelKey)}
          </Link>
        ) : (
          <Text key={item.key} style={styles.comingSoon}>
            {t(item.labelKey)} · {t('nav.comingSoon')}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.brand700,
  },
  comingSoon: {
    fontSize: 15,
    color: colors.text700,
    opacity: 0.5,
  },
});
