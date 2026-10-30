import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text } from 'react-native';

import { FilterGroup, FilterOption, filterPageStyles as styles } from '@/components/FilterControls';
import { COURSE_PERIODS, parseCoursePeriod } from '@/features/courses/schedule';

/**
 * Die Filterseite der Kurse (30.10.2026): Zeitraum waehlen, zurueck zur Liste.
 * Ersetzt die Seite in der Historie - "Zurueck" fuehrt danach nicht wieder
 * hierher, sondern dorthin, woher man zu den Kursen kam.
 */
export default function KurseFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const current = parseCoursePeriod(useLocalSearchParams<{ zeitraum?: string }>().zeitraum);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href={{ pathname: '/kurse', params: current === 'alle' ? {} : { zeitraum: current } }} style={styles.back}>
        {t('kurse.filter.back')}
      </Link>
      <Text role="heading" style={styles.title}>
        {t('kurse.filter.title')}
      </Text>
      <FilterGroup title={t('kurse.filter.periodTitle')}>
        {COURSE_PERIODS.map((period) => (
          <FilterOption
            key={period}
            label={t(`kurse.filter.period.${period}`)}
            selected={period === current}
            onPress={() =>
              router.replace({ pathname: '/kurse', params: period === 'alle' ? {} : { zeitraum: period } })
            }
          />
        ))}
      </FilterGroup>
    </ScrollView>
  );
}
