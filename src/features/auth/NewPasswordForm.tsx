import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/design/tokens';
import { authErrorMessageKey } from '@/features/auth/authErrors';
import { TextField } from '@/components/TextField';
import { MIN_PASSWORD_LENGTH, newPasswordSchema, type NewPasswordValues } from '@/features/auth/schema';
import { supabase } from '@/lib/supabase';

// Schritt 2 von "Passwort vergessen". Der Link aus der E-Mail hat supabase-js
// beim Laden der Seite bereits eine Sitzung verschafft (detectSessionInUrl) -
// deshalb genuegt hier updateUser, und es braucht weder Token noch altes
// Passwort im Formular.
export function NewPasswordForm() {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { control, handleSubmit, formState } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordRepeat: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: NewPasswordValues) => {
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormError(t(authErrorMessageKey(error)));
      return;
    }
    setDone(true);
  };

  const fieldError = (message?: string) =>
    message ? t(message, { min: MIN_PASSWORD_LENGTH }) : undefined;

  if (done) {
    return (
      <View style={styles.form}>
        <Text style={styles.title}>{t('passwortNeu.doneTitle')}</Text>
        <Text style={styles.hint}>{t('passwortNeu.doneBody')}</Text>
        <Link href="/konto" style={styles.link}>
          {t('passwortNeu.toAccount')}
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.hint}>{t('passwortNeu.hint')}</Text>

      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t('passwortNeu.field')}
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

      {formError ? (
        <View role="alert" style={styles.formError}>
          <Text style={styles.formErrorText}>{formError}</Text>
        </View>
      ) : null}

      <Button
        block
        disabled={formState.isSubmitting}
        label={formState.isSubmitting ? t('passwortNeu.pending') : t('passwortNeu.submit')}
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  hint: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
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
