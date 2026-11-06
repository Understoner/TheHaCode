import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/design/tokens';

import { newsSchema, type NewsValues } from './newsForm';
import type { NewsPost } from './useNewsList';
import { useUpdateNewsPost } from './useNewsPost';

/**
 * Titel, Anriss und Text eines Beitrags aendern (06.11.2026, Wunsch des Users:
 * Abweichung von "Redaktion nur im Studio"). Sichtbar nur fuer Admins; die
 * Grenze zieht die Datenbank (news_admin_write).
 */
export function NewsEditor({ post, onClose }: { post: NewsPost; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateNewsPost(post);
  const { control, handleSubmit } = useForm<NewsValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: { title: post.title, excerpt: post.excerpt ?? '', body: post.body_md },
    mode: 'onTouched',
  });

  return (
    <View style={styles.form}>
      <NewsField control={control} name="title" label={t('news.edit.fieldTitle')} />
      <NewsField control={control} name="excerpt" label={t('news.edit.fieldExcerpt')} lines={3} />
      <NewsField control={control} name="body" label={t('news.edit.fieldBody')} lines={18} />
      <Text style={styles.hint}>{t('news.edit.hint')}</Text>

      {update.error ? (
        <Text role="alert" style={styles.error}>
          {t('errors:news.saveFailed')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={t('news.edit.save')}
          disabled={update.isPending}
          onPress={handleSubmit((values) => update.mutate(values, { onSuccess: onClose }))}
        />
        <PressableRing onPress={onClose} role="button" style={styles.cancel}>
          <Text style={styles.cancelText}>{t('news.edit.cancel')}</Text>
        </PressableRing>
      </View>
    </View>
  );
}

function NewsField({
  control,
  name,
  label,
  lines,
}: {
  control: Control<NewsValues>;
  name: keyof NewsValues;
  label: string;
  lines?: number;
}) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          multiline={lines !== undefined}
          numberOfLines={lines}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink700,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cancel: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.full,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
});
