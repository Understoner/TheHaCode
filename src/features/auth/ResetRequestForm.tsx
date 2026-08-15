import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/design/tokens';
import { authErrorMessageKey } from '@/features/auth/authErrors';
import { TextField } from '@/components/TextField';
import { resetRequestSchema, type ResetRequestValues } from '@/features/auth/schema';
import { supabase } from '@/lib/supabase';

// Schritt 1 von "Passwort vergessen": Adresse eingeben, Link anfordern.
// Schritt 2 steht auf /passwort-neu.
export function ResetRequestForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: ResetRequestValues) => {
    setFormError(null);
    const email = values.email.trim();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window === 'undefined' ? undefined : `${window.location.origin}/passwort-neu`,
    });

    if (error) {
      setFormError(t(authErrorMessageKey(error)));
      return;
    }

    // Supabase antwortet auch dann mit Erfolg, wenn es zu der Adresse gar kein
    // Konto gibt - sonst liesse sich hier durchprobieren, wer angemeldet ist.
    // Der Text unten sagt deshalb bewusst nicht "wir haben geschickt", sondern
    // "falls es ein Konto gibt".
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <View style={styles.form}>
        <Text style={styles.title}>{t('auth.reset.sentTitle')}</Text>
        <Text style={styles.hint}>{t('auth.reset.sentBody', { email: sentTo })}</Text>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>{t('auth.reset.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{t('auth.reset.title')}</Text>
      <Text style={styles.hint}>{t('auth.reset.hint')}</Text>

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

      {formError ? (
        <View role="alert" style={styles.formError}>
          <Text style={styles.formErrorText}>{formError}</Text>
        </View>
      ) : null}

      <Button
        block
        disabled={formState.isSubmitting}
        label={formState.isSubmitting ? t('auth.reset.pending') : t('auth.reset.submit')}
        onPress={handleSubmit(onSubmit)}
      />

      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>{t('auth.reset.back')}</Text>
      </Pressable>
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
  back: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  backText: {
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
