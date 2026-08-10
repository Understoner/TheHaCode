import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { LegalPlaceholderBanner } from '@/components/LegalPlaceholderBanner';
import { colors, spacing } from '@/design/tokens';
import { hasLegalPlaceholder } from '@/i18n/legalPlaceholder';

export default function ImpressumScreen() {
  const { t } = useTranslation('legal');

  const name = t('impressum.name');
  const address = t('impressum.address');
  const email = t('impressum.email');
  const phone = t('impressum.phone');
  const uid = t('impressum.uid');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LegalPlaceholderBanner active={hasLegalPlaceholder([name, address, email, phone, uid])} />
      <Text style={styles.title}>{t('impressum.title')}</Text>

      <Text style={styles.sectionTitle}>{t('impressum.sectionAngaben')}</Text>
      <Text style={styles.text}>{name}</Text>
      <Text style={styles.text}>{address}</Text>
      <Text style={styles.text}>{email}</Text>
      <Text style={styles.text}>{phone}</Text>
      <Text style={styles.text}>{uid}</Text>
      <Text style={styles.text}>{t('impressum.kleinunternehmer')}</Text>

      <Text style={styles.sectionTitle}>{t('impressum.sectionStreit')}</Text>
      <Text style={styles.text}>{t('impressum.streitschlichtung')}</Text>
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
