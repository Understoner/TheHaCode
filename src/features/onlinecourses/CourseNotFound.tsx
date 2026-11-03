import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StateMessage } from '@/components/StateMessage';
import { colors, spacing } from '@/design/tokens';

export function CourseNotFound() {
  const { t } = useTranslation();
  return (
    <View style={styles.box}>
      <StateMessage title={t('onlineCourses.notFound.title')} body={t('onlineCourses.notFound.hint')} />
      <Link href="/kurse?art=ondemand" style={styles.link}>
        {t('onlineCourses.back')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  link: { fontSize: 15, fontWeight: '600', color: colors.ocean700 },
});
