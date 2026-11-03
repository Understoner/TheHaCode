import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { colors, radius } from '@/design/tokens';
import type { CourseAccess } from './courseLogic';

// Wie ein Onlinekurs zugaenglich ist - als Text, nicht nur als Farbe.
const TONE: Record<CourseAccess, string> = {
  public: colors.sage700,
  account: colors.ink700,
  plus: colors.ocean700,
  paid: colors.ink900,
};

export function AccessBadge({ access }: { access: CourseAccess }) {
  const { t } = useTranslation();
  return (
    <Text style={[styles.badge, { color: TONE[access], borderColor: TONE[access] }]}>
      {t(`onlineCourses.access.${access}`)}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
});
