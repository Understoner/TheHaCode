import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { LegalPlaceholderBanner } from '@/components/LegalPlaceholderBanner';
import { colors, spacing } from '@/design/tokens';
import { hasLegalPlaceholder } from '@/i18n/legalPlaceholder';

export default function DatenschutzScreen() {
  const { t } = useTranslation('legal');

  const verantwortlicherName = t('datenschutz.verantwortlicherName');
  const verantwortlicherAddress = t('datenschutz.verantwortlicherAddress');
  const verantwortlicherEmail = t('datenschutz.verantwortlicherEmail');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LegalPlaceholderBanner
        active={hasLegalPlaceholder([verantwortlicherName, verantwortlicherAddress, verantwortlicherEmail])}
      />
      <Text style={styles.title}>{t('datenschutz.title')}</Text>
      <Text style={styles.text}>{t('datenschutz.intro')}</Text>

      <Text style={styles.sectionTitle}>{t('datenschutz.sectionVerantwortlicher')}</Text>
      <Text style={styles.text}>{verantwortlicherName}</Text>
      <Text style={styles.text}>{verantwortlicherAddress}</Text>
      <Text style={styles.text}>{verantwortlicherEmail}</Text>

      <Text style={styles.sectionTitle}>{t('datenschutz.sectionHosting')}</Text>
      <Text style={styles.text}>{t('datenschutz.hosting')}</Text>

      <Text style={styles.sectionTitle}>{t('datenschutz.sectionTracking')}</Text>
      <Text style={styles.text}>{t('datenschutz.tracking')}</Text>

      <Text style={styles.sectionTitle}>{t('datenschutz.sectionRechte')}</Text>
      <Text style={styles.text}>{t('datenschutz.rechte')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text700,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text700,
    marginTop: spacing.md,
  },
  text: {
    fontSize: 15,
    color: colors.text700,
  },
});
