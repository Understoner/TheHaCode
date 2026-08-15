import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/design/tokens';
import { authErrorMessageKey } from '@/features/auth/authErrors';
import { TextField } from '@/features/auth/TextField';
import { signInSchema, type SignInValues } from '@/features/auth/schema';
import { supabase } from '@/lib/supabase';

// Anmeldung mit E-Mail und Passwort. Sitzung, Token und Erneuerung uebernimmt
// vollstaendig supabase-js (CLAUDE.md); hier steht nur das Formular.
export function SignInForm() {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    // Nicht bei jedem Tastendruck meckern, aber sobald ein Feld einmal
    // verlassen wurde.
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignInValues) => {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });
    // Beim Erfolg ist hier nichts zu tun: onAuthStateChange im AuthProvider
    // meldet die neue Sitzung, und die Konto-Seite zeigt daraufhin von selbst
    // den angemeldeten Zustand.
    if (error) setFormError(t(authErrorMessageKey(error)));
  };

  return (
    <View style={styles.form}>
      <Text style={styles.hint}>{t('auth.signIn.hint')}</Text>

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.field.email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
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
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            secureTextEntry
            autoComplete="current-password"
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
        label={formState.isSubmitting ? t('auth.signIn.pending') : t('auth.signIn.submit')}
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
  hint: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  // Der Fehler zur ganzen Anmeldung steht ueber dem Button, nicht an einem
  // Feld: welches der beiden nicht stimmt, sagt Supabase bewusst nicht - sonst
  // liesse sich damit herausfinden, welche Adressen ein Konto haben.
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
