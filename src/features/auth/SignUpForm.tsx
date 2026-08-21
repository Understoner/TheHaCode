import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { colors, radius, spacing } from '@/design/tokens';
import { authErrorMessageKey } from '@/features/auth/authErrors';
import { TextField } from '@/components/TextField';
import { MIN_PASSWORD_LENGTH, signUpSchema, type SignUpValues } from '@/features/auth/schema';
import { supabase } from '@/lib/supabase';

// Registrierung ueber Supabase Auth. Die profiles-Zeile legt der Trigger aus
// Migration 0001 an, die Einwilligungszeilen der Trigger aus 0013 - der Client
// schreibt weder in auth.users noch in profiles noch in user_consents
// (CLAUDE.md).
//
// WARUM EIN HAKEN FUER DIE AGB, ABER KEINER FUER DEN DATENSCHUTZ
// ---------------------------------------------------------------
// Das ist kein Versehen, sondern der Unterschied zwischen zwei Rechtsgruenden.
//
// Die AGB sind Vertragsinhalt. Sie gelten nur, wenn der Kunde sie bei
// Vertragsschluss annimmt - ohne Haken sind sie womoeglich nicht einbezogen,
// und § 11 AGB (Anmeldung wird mit der Bestaetigung verbindlich) haengt in der
// Luft. Der Haken gehoert also hierher, und er ist Pflicht.
//
// Die Datenschutzerklaerung ist KEINE Einwilligung. Verarbeitet wird auf
// Grundlage des Vertrags (Art. 6 Abs. 1 lit. b DSGVO), nicht auf Grundlage
// einer Zustimmung. Wer trotzdem ein Pflichthaekchen davorsetzt, holt sich eine
// Einwilligung, die er nicht braucht und die - weil erzwungen - keine
// freiwillige waere. Zu tun ist etwas anderes: informieren, sichtbar, vorher.
// Deshalb steht darunter weiterhin nur der Hinweis mit dem Verweis.
//
// In user_consents landen trotzdem beide Zeilen, und der Wortlaut der
// Definitionen sagt genau das: bei den AGB "stimme ihnen zu", beim Datenschutz
// "zur Kenntnis genommen" (Migration 0012).
export function SignUpForm() {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  // Gesetzt, sobald Supabase eine Bestaetigungsmail verschickt hat statt direkt
  // anzumelden. Ob das passiert, entscheidet die Projekteinstellung
  // (auth.email.enable_confirmations) - der Client muss beide Faelle koennen.
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      passwordRepeat: '',
      acceptsTerms: false,
    },
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignUpValues) => {
    setFormError(null);
    const email = values.email.trim();
    const name = values.name.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: {
        // full_name liest der Trigger handle_new_user und schreibt ihn nach
        // profiles.display_name; consented_at liest handle_new_user_consents
        // und macht daraus die Zeilen in user_consents (Migration 0013).
        //
        // Warum ueber die Metadaten und nicht mit einem eigenen Insert: im
        // Moment der Registrierung gibt es noch keine Sitzung, solange die
        // E-Mail-Bestaetigung eingeschaltet ist - ein Insert scheiterte an
        // auth.uid() = null. Die Fassung, der zugestimmt wird, bestimmt
        // ohnehin der Trigger und nicht der Client.
        data: {
          ...(name ? { full_name: name } : {}),
          consented_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      setFormError(t(authErrorMessageKey(error)));
      return;
    }

    // Kommt eine Sitzung zurueck, ist der Nutzer bereits angemeldet und der
    // AuthProvider schaltet die Seite um. Sonst wartet eine Bestaetigungsmail.
    if (!data.session) setConfirmationSentTo(email);
  };

  const fieldError = (message?: string) =>
    message ? t(message, { min: MIN_PASSWORD_LENGTH }) : undefined;

  if (confirmationSentTo) {
    return (
      <View style={styles.form}>
        <Text style={styles.confirmTitle}>{t('auth.signUp.confirmTitle')}</Text>
        <Text style={styles.hint}>
          {t('auth.signUp.confirmBody', { email: confirmationSentTo })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.hint}>{t('auth.signUp.hint')}</Text>

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.field.email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldError(fieldState.error?.message)}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      />

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.field.name')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldError(fieldState.error?.message)}
            autoComplete="name"
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.field.password')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldError(fieldState.error?.message)}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      />

      <Controller
        control={control}
        name="passwordRepeat"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.field.passwordRepeat')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldError(fieldState.error?.message)}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      />

      <Controller
        control={control}
        name="acceptsTerms"
        render={({ field, fieldState }) => (
          <Checkbox
            checked={field.value}
            onToggle={() => field.onChange(!field.value)}
            label={t('auth.signUp.termsLabel')}
            error={fieldError(fieldState.error?.message)}
          >
            {t('auth.signUp.termsVorspann')}{' '}
            <Link href="/agb" style={styles.legalLink}>
              {t('footer.agb')}
            </Link>{' '}
            {t('auth.signUp.termsUnd')}{' '}
            <Link href="/haftungsausschluss" style={styles.legalLink}>
              {t('footer.haftungsausschluss')}
            </Link>
            {t('auth.signUp.termsSchluss')}
          </Checkbox>
        )}
      />

      {formError ? (
        <View role="alert" style={styles.formError}>
          <Text style={styles.formErrorText}>{formError}</Text>
        </View>
      ) : null}

      <Button
        block
        disabled={formState.isSubmitting}
        label={formState.isSubmitting ? t('auth.signUp.pending') : t('auth.signUp.submit')}
        onPress={handleSubmit(onSubmit)}
      />

      {/* Fuer den Datenschutz weiterhin kein Haekchen - siehe oben: eine
          erzwungene Zustimmung waere keine freiwillige Einwilligung, und
          gebraucht wird sie gar nicht. Der Hinweis samt Verweis genuegt und
          muss trotzdem sichtbar sein. */}
      <Text style={styles.legal}>
        {t('auth.signUp.legal')}{' '}
        <Link href="/datenschutz" style={styles.legalLink}>
          {t('footer.datenschutz')}
        </Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  hint: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  legal: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  legalLink: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ocean700,
    textDecorationLine: 'underline',
  },
  formError: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  formErrorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink900,
  },
});
