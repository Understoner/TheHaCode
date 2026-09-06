import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/design/tokens';
import { AgbConsent } from '@/features/courses/AgbConsent';
import { bookingErrorCode, guestBookingSchema, type GuestBookingValues } from '@/features/courses/booking';
import { useCourseCheckout } from '@/features/courses/useCourseBooking';
import { openExternalUrl } from '@/lib/externalLink';

// Buchen ohne Konto.
//
// WARUM ES DAS GIBT
// -----------------
// Ein Kurs ist ein Kaufvorgang, kein Zugang. Wer den Online-Kurs bucht, bekommt
// danach einen Termin und einen Link - nichts, wofuer er sich anmelden muesste.
// Eine Registrierung davorzusetzen kostet Buchungen und bringt niemandem etwas.
//
// WAS DAS FORMULAR NICHT TUT
// --------------------------
// Es legt kein Konto an, auch keines im Verborgenen. Es entscheidet auch nicht
// ueber Preis, Platz oder Anzahlung - das tut die Datenbank unter Sperre
// (Migration 0011/0015). Hier werden zwei Angaben eingesammelt und
// weitergereicht.
//
// Die Adresse ist die einzige Verbindung zum Gast: an sie geht der
// Zahlungsbeleg, und der ist nach § 11 AGB die Bestaetigung. Sie ist deshalb
// KEIN Schluessel (SAD §4.3 Punkt 5) - die Buchung selbst wird ueber ihre ID
// zugeordnet, nicht ueber die Adresse.
export function GuestBookingForm({ courseSlug, label }: { courseSlug: string; label: string }) {
  const { t } = useTranslation();
  const checkout = useCourseCheckout();

  const { control, handleSubmit } = useForm<GuestBookingValues>({
    resolver: zodResolver(guestBookingSchema),
    defaultValues: { name: '', email: '', agb: false },
    // Erst melden, wenn jemand ein Feld verlassen hat - nicht schon beim
    // ersten Buchstaben.
    mode: 'onTouched',
  });

  const onSubmit = (values: GuestBookingValues) => {
    checkout.mutate(
      {
        courseSlug,
        guest: { email: values.email.trim(), name: values.name.trim() },
      },
      { onSuccess: (url) => openExternalUrl(url) },
    );
  };

  return (
    <View style={styles.stack}>
      <Text style={styles.hint}>{t('kurse.buchung.gastText')}</Text>

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label={t('kurse.buchung.gastName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoComplete="name"
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('kurse.buchung.gastEmail')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />

      <Text style={styles.hint}>{t('kurse.buchung.gastEmailHinweis')}</Text>

      <Controller
        control={control}
        name="agb"
        render={({ field, fieldState }) => (
          <AgbConsent
            checked={field.value}
            onToggle={() => field.onChange(!field.value)}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
          />
        )}
      />

      <Button
        label={checkout.isPending ? t('kurse.buchung.wirdGeoeffnet') : label}
        onPress={handleSubmit(onSubmit)}
        disabled={checkout.isPending}
      />

      {checkout.isError ? (
        <Text role="alert" style={styles.error}>
          {t(`errors:buchung.${bookingErrorCode(checkout.error)}`)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
});
