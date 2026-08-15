import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { SessionsList } from '@/features/sessions/SessionsList';

export default function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('sessions.title')}</Text>
      <Text style={styles.intro}>{t('sessions.intro')}</Text>

      {/* Der Konfigurator haengt bewusst an den Sessions und bekommt keinen
          eigenen Eintrag in der Navigation (so schon in design/navigation.ts
          vorgesehen): auf dem Handy sind fuenf Eintraege in der Tab-Leiste die
          Grenze, und wer eigene Sequenzen sucht, sucht sie bei den Sequenzen. */}
      <Link href="/sequenzen" style={styles.mine}>
        {t('sessions.meine')}
      </Link>

      <SessionsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
  intro: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink700,
    paddingHorizontal: spacing.md,
    maxWidth: 620,
    marginBottom: spacing.sm,
  },
  mine: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    color: colors.ocean700,
    fontSize: 14,
    fontWeight: '600',
  },
});
