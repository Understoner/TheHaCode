import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';

// Die Rueckkehr von Stripe.
//
// § 11 AGB macht die Anmeldung mit der Bestaetigung verbindlich. Die
// Bestaetigung ist der Zahlungsbeleg, den Stripe selbst verschickt (T20,
// Entscheidung vom 21.08.2026) - dieser Hinweis sagt dem Nutzer, dass er
// kommt, und was bei einer Anzahlung als Naechstes passiert.
//
// Sie liest nur, was in der Adresse steht, und niemals einen Zahlungsstatus:
// ob wirklich bezahlt wurde, weiss allein der Webhook. Eine Erfolgsmeldung aus
// der Adresszeile ist eine Empfangsbestaetigung, kein Kontostand - deshalb
// steht hier "eingegangen" und nicht "bezahlt".
export type BookingResult = 'erfolg' | 'abgebrochen' | null;

export function bookingResultFrom(value: unknown): BookingResult {
  return value === 'erfolg' || value === 'abgebrochen' ? value : null;
}

export function BookingResultBanner({ result }: { result: BookingResult }) {
  const { t } = useTranslation();

  if (!result) return null;

  const success = result === 'erfolg';

  return (
    <View role="status" style={[styles.card, success ? styles.success : styles.neutral]}>
      <Text style={styles.title}>
        {success ? t('kurse.buchung.erfolgTitel') : t('kurse.buchung.abbruchTitel')}
      </Text>
      <Text style={styles.body}>
        {success ? t('kurse.buchung.erfolgText') : t('kurse.buchung.abbruchText')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 4,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  success: {
    borderColor: colors.sage700,
  },
  neutral: {
    borderColor: colors.line,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
});
