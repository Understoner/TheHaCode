import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { displayFont } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { ONLINE_COURSES_ENABLED } from './flag';
import { KindIcon } from './KindIcon';

// Der Weg zu den Onlinekursen von der Kurse-Seite aus. Kein eigener Tab: die
// Tab-Leiste ist mit sechs Eintraegen voll, und Onlinekurse sind Kurse.
export function OnlineCoursesTeaser() {
  const { t } = useTranslation();
  if (!ONLINE_COURSES_ENABLED) return null;

  return (
    <Link href="/onlinekurse" asChild>
      <PressableRing style={styles.card} aria-label={t('onlineCourses.teaser.action')}>
        <KindIcon kind="video" size={44} />
        <View style={styles.text}>
          <Text style={styles.title} {...displayFont}>
            {t('onlineCourses.teaser.title')}
          </Text>
          <Text style={styles.body}>{t('onlineCourses.teaser.text')}</Text>
        </View>
        <Text style={styles.action}>{t('onlineCourses.teaser.action')}</Text>
      </PressableRing>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minWidth: 200, gap: 2 },
  title: { fontSize: 18, color: colors.ink900 },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink700 },
  action: { fontSize: 14, fontWeight: '700', color: colors.ocean700 },
});
