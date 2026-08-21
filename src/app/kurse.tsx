import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { BookingResultBanner, bookingResultFrom } from '@/features/courses/BookingResultBanner';
import { CoursesList } from '@/features/courses/CoursesList';

export default function KurseScreen() {
  const { t } = useTranslation();
  // Stripe schickt den Nutzer mit ?buchung=erfolg bzw. =abgebrochen zurueck
  // (create-course-checkout). Mehr steht in der Adresse nicht, und mehr wird
  // ihr auch nicht geglaubt - siehe BookingResultBanner.
  const { buchung } = useLocalSearchParams<{ buchung?: string }>();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('kurse.title')}</Text>
      <BookingResultBanner result={bookingResultFrom(buchung)} />
      <CoursesList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
    paddingHorizontal: spacing.md,
  },
});
