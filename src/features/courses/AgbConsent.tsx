import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Checkbox } from '@/components/Checkbox';
import { colors } from '@/design/tokens';

// Der Haken bei den AGB, einmal fuer beide Buchungswege.
//
// Er ist keine Zierde: § 11 AGB macht die Anmeldung erst mit der Bestaetigung
// verbindlich, und das traegt nur, wenn die AGB einbezogen wurden. Der
// Zeitpunkt landet in course_bookings.agb_accepted_at - fuer Konten wie fuer
// Gaeste gleichermassen.
export function AgbConsent({
  checked,
  onToggle,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  /** Bereits uebersetzter Text, leer wenn der Haken sitzt. */
  error?: string;
}) {
  const { t } = useTranslation();

  return (
    <Checkbox checked={checked} onToggle={onToggle} label={t('kurse.buchung.agbLabel')} error={error}>
      {t('kurse.buchung.agbVorspann')}{' '}
      <Link href="/agb" style={styles.link}>
        {t('kurse.buchung.agbLink')}
      </Link>{' '}
      {t('kurse.buchung.agbUnd')}{' '}
      <Link href="/haftungsausschluss" style={styles.link}>
        {t('kurse.buchung.haftungLink')}
      </Link>
      {t('kurse.buchung.agbSchluss')}
    </Checkbox>
  );
}

const styles = StyleSheet.create({
  link: {
    fontWeight: '600',
    color: colors.ocean700,
  },
});
