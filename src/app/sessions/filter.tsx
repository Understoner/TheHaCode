import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text } from 'react-native';

import { FilterGroup, FilterOption, filterPageStyles as styles } from '@/components/FilterControls';
import {
  SESSION_FILTERS,
  effectColors,
  parseSessionFilter,
  type SessionFilter,
} from '@/features/sessions/effects';

/**
 * Die Filterseite der Sessions (30.10.2026). Bis dahin standen die Optionen
 * als Chips ueber der Liste und schoben die Sessions nach unten.
 */
export default function SessionsFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const current = parseSessionFilter(useLocalSearchParams<{ filter?: string }>().filter);
  const back = (value: SessionFilter) =>
    ({ pathname: '/sessions', params: value === 'all' ? {} : { filter: value } }) as const;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href={back(current)} style={styles.back}>
        {t('sessions.filter.back')}
      </Link>
      <Text role="heading" style={styles.title}>
        {t('sessions.filter.title')}
      </Text>
      <FilterGroup title={t('sessions.filter.groupTitle')}>
        {SESSION_FILTERS.map((value) => (
          <FilterOption
            key={value}
            label={
              value === 'all'
                ? t('sessions.filter.all')
                : value === 'favoriten'
                  ? t('favoriten.filter')
                  : t(`sessions.effects.${value}`)
            }
            // Die Effektfarbe wie frueher am Chip - die Farbe sagt die
            // Richtung (fordert / faehrt herunter).
            tone={value === 'all' || value === 'favoriten' ? undefined : effectColors(value).text}
            selected={value === current}
            onPress={() => router.replace(back(value))}
          />
        ))}
      </FilterGroup>
    </ScrollView>
  );
}
