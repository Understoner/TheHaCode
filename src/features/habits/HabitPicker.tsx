import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

import { diaryErrorKey } from './diaryErrors';
import {
  useChooseHabit,
  type HabitCategory,
  type HabitTemplate,
  type MyHabit,
} from './useHabits';

/**
 * Habits aufnehmen und herausnehmen, nach Kategorie.
 *
 * Gesperrte Habits stehen mit da - sichtbar, aber nicht waehlbar. Das ist die
 * Vorschau: wer ohne Plus BOLT fuehrt, sieht, was es sonst noch gibt. Die
 * Sperre selbst sitzt in der Datenbank (can_use_habit_template, 0021); hier
 * wird sie nur vorher angezeigt.
 */
export function HabitPicker({
  categories,
  templates,
  myHabits,
  plusAccess,
}: {
  categories: HabitCategory[];
  templates: HabitTemplate[];
  myHabits: MyHabit[];
  plusAccess: boolean;
}) {
  const { t } = useTranslation();
  const choose = useChooseHabit();
  const active = new Set(myHabits.filter((h) => h.is_active).map((h) => h.template_id));

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('diary.picker.title')}</Text>

      {choose.error ? (
        <Text role="alert" style={styles.error}>
          {t(diaryErrorKey(choose.error))}
        </Text>
      ) : null}

      {categories.map((category) => {
        const inCategory = templates.filter((tpl) => tpl.category_id === category.id);
        if (inCategory.length === 0) return null;

        return (
          <View key={category.id} style={styles.group}>
            <Text style={styles.category}>{category.title}</Text>
            {inCategory.map((template) => {
              const chosen = active.has(template.id);
              const locked = !template.is_preview && !plusAccess;

              return (
                <View key={template.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.title}>{template.title}</Text>
                    <Text style={template.is_preview ? styles.badgePreview : styles.badgePlus}>
                      {template.is_preview ? t('diary.picker.preview') : t('diary.picker.plus')}
                    </Text>
                    {template.description_md ? (
                      <Text style={styles.description}>{template.description_md}</Text>
                    ) : null}
                  </View>

                  {locked && !chosen ? (
                    <Link href="/plus" style={styles.plusLink}>
                      {t('diary.picker.toPlus')}
                    </Link>
                  ) : (
                    <PressableRing
                      onPress={() =>
                        choose.mutate({
                          templateId: template.id,
                          chosen: !chosen,
                          sortOrder: template.sort_order,
                        })
                      }
                      disabled={choose.isPending}
                      style={[styles.action, chosen && styles.actionOn]}
                    >
                      <Text style={[styles.actionText, chosen && styles.actionTextOn]}>
                        {chosen ? t('diary.picker.remove') : t('diary.picker.add')}
                      </Text>
                    </PressableRing>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink900,
  },
  group: {
    gap: spacing.sm,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  badgePreview: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    color: colors.sage700,
    backgroundColor: colors.sageTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgePlus: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    color: colors.ocean700,
    backgroundColor: colors.oceanTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
  },
  actionOn: {
    borderColor: colors.line,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  actionTextOn: {
    color: colors.ink700,
  },
  plusLink: {
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
