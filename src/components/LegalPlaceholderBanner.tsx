import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';

type Props = {
  active: boolean;
};

// Anders als StagingBanner NICHT auf EXPO_PUBLIC_APP_ENV beschraenkt: die
// Domain wird sofort nach Fertigstellung umgehaengt (SAD §2.4), das
// Sicherheitsnetz muss deshalb auch in Production wirken.
export function LegalPlaceholderBanner({ active }: Props) {
  const { t } = useTranslation('legal');

  if (!active) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('placeholderBanner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.warningSurface,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink700,
  },
});
