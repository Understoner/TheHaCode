import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActiveFilter } from '@/components/FilterControls';
import { FilterGlyph, HEADER_ICON_SIZE, HeaderIconLink } from '@/components/HeaderIcon';
import { colors, spacing } from '@/design/tokens';
import { BookingResultBanner, bookingResultFrom } from '@/features/courses/BookingResultBanner';
import { CoursesList } from '@/features/courses/CoursesList';
import { parseCoursePeriod } from '@/features/courses/schedule';

export default function KurseScreen() {
  const { t } = useTranslation();
  // Stripe schickt den Nutzer mit ?buchung=erfolg bzw. =abgebrochen zurueck
  // (create-course-checkout). Mehr steht in der Adresse nicht, und mehr wird
  // ihr auch nicht geglaubt - siehe BookingResultBanner.
  //
  // ?zeitraum= setzt die Filterseite (/kurse/filter, 30.10.2026). Der Filter
  // steht in der Adresse statt in einem Zustand: so ueberlebt er das
  // Zurueckkehren von der Filterseite und laesst sich verlinken.
  const { buchung, zeitraum } = useLocalSearchParams<{ buchung?: string; zeitraum?: string }>();
  const period = parseCoursePeriod(zeitraum);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <Text role="heading" style={styles.title}>
          {t('kurse.title')}
        </Text>
        <HeaderIconLink
          href={{ pathname: '/kurse/filter', params: { zeitraum: period } }}
          label={t('kurse.filter.open')}
          active={period !== 'alle'}
        >
          <FilterGlyph active={period !== 'alle'} />
        </HeaderIconLink>
      </View>
      {period !== 'alle' ? (
        <View style={styles.inset}>
          <ActiveFilter summary={t(`kurse.filter.period.${period}`)} resetHref="/kurse" />
        </View>
      ) : null}
      <BookingResultBanner result={bookingResultFrom(buchung)} />
      <CoursesList period={period} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: HEADER_ICON_SIZE,
    fontWeight: '600',
    color: colors.ink900,
  },
  inset: {
    paddingHorizontal: spacing.md,
    marginTop: -spacing.sm,
  },
});
