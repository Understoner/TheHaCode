import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';

import { diaryErrorKey } from './diaryErrors';
import { HabitLinkButton } from './HabitLinkButton';
import {
  filterTemplates,
  groupByCategory,
  isOwn,
  NO_FILTER,
  type HabitFilter,
} from './habitFilter';
import {
  useChooseHabit,
  useToggleHabitFavorite,
  type HabitCategory,
  type HabitTemplate,
  type MyHabit,
} from './useHabits';

/**
 * Die Habit-Auswahl: aufnehmen, herausnehmen, merken. Gefiltert wird auf
 * einer eigenen Seite (seit 30.10.2026); hier kommt der Filter nur an.
 *
 * Gesperrte Habits stehen mit da - sichtbar, aber nicht waehlbar. Das ist die
 * Vorschau: wer ohne Plus BOLT fuehrt, sieht, was es sonst noch gibt. Die
 * Sperre selbst sitzt in der Datenbank (can_use_habit_template, 0021/0024);
 * hier wird sie nur vorher angezeigt.
 */
export function HabitCatalog({
  categories,
  templates,
  myHabits,
  favorites,
  plusAccess,
  filter = NO_FILTER,
}: {
  categories: HabitCategory[];
  templates: HabitTemplate[];
  myHabits: MyHabit[];
  favorites: ReadonlySet<string>;
  plusAccess: boolean;
  /** Aus der Adresse, gesetzt auf /habit-tracker/auswahl-filter (30.10.2026). */
  filter?: HabitFilter;
}) {
  const { t } = useTranslation();
  const choose = useChooseHabit();
  const toggleFavorite = useToggleHabitFavorite();
  const active = new Set(myHabits.filter((h) => h.is_active).map((h) => h.template_id));

  const groups = useMemo(
    () => groupByCategory(categories, filterTemplates(templates, filter, favorites), favorites),
    [categories, templates, filter, favorites],
  );

  const error = choose.error ?? toggleFavorite.error;

  return (
    <View style={styles.section}>
      {error ? (
        <Text role="alert" style={styles.error}>
          {t(diaryErrorKey(error))}
        </Text>
      ) : null}

      {groups.length === 0 ? (
        <StateMessage
          title={t(filter.source === 'own' ? 'habits.empty.ownTitle' : 'habits.empty.title')}
          body={t(filter.source === 'own' ? 'habits.empty.ownHint' : 'habits.empty.hint')}
        />
      ) : (
        groups.map(({ category, templates: inCategory }) => (
          <View key={category.id} style={styles.group}>
            <Text style={styles.category}>{category.title}</Text>
            {category.description ? (
              <Text style={styles.categoryText}>{category.description}</Text>
            ) : null}
            <View {...responsive('habits-grid')} style={styles.grid}>
              {inCategory.map((template) => (
                <HabitRow
                  key={template.id}
                  template={template}
                  category={category}
                  chosen={active.has(template.id)}
                  favorite={favorites.has(template.id)}
                  locked={!template.is_preview && !plusAccess}
                  pending={choose.isPending}
                  onToggleFavorite={(favorite) =>
                    toggleFavorite.mutate({ templateId: template.id, favorite })
                  }
                  onChoose={(chosen) =>
                    choose.mutate({ templateId: template.id, chosen, sortOrder: template.sort_order })
                  }
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Eine Karte der Auswahl, angelegt wie die Session-Karten (26.10.2026): oben
 * die Eckdaten, dann Titel und Herkunft, darunter die Beschreibung auf bis zu
 * fuenf Zeilen. "Details" zeigt den ganzen Text und die Eckdaten ausfuehrlich.
 * Aufnehmen sitzt unten, damit es in einer Reihe ungleich hoher Karten immer
 * an derselben Stelle steht.
 */
function HabitRow({
  template,
  category,
  chosen,
  favorite,
  locked,
  pending,
  onToggleFavorite,
  onChoose,
}: {
  template: HabitTemplate;
  category: HabitCategory;
  chosen: boolean;
  favorite: boolean;
  locked: boolean;
  pending: boolean;
  onToggleFavorite: (favorite: boolean) => void;
  onChoose: (chosen: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const own = isOwn(template);
  const negative = template.is_negative || category.is_negative;

  const entryKind =
    template.tracking_type === 'number'
      ? [
          template.unit
            ? t('habits.details.number', { unit: template.unit })
            : t('habits.details.numberPlain'),
          template.min_value !== null && template.max_value !== null
            ? t('habits.details.range', { min: template.min_value, max: template.max_value })
            : null,
        ]
          .filter(Boolean)
          .join(' ')
      : t('habits.details.done');
  const pointsText = t(
    negative ? 'habits.details.pointsValueNegative' : 'habits.details.pointsValue',
    { count: template.points },
  );

  return (
    <View style={styles.row}>
      <View style={styles.metaRow}>
        <Text style={negative ? styles.metaNegative : styles.metaPositive}>{pointsText}</Text>
        <Text style={styles.meta}>{entryKind}</Text>
      </View>

      <View style={styles.rowHead}>
        <View style={styles.rowTitle}>
          <Text style={styles.title}>{template.title}</Text>
          <Text
            style={own ? styles.badgeOwn : template.is_preview ? styles.badgePreview : styles.badgePlus}
          >
            {own
              ? t('habits.badge.own')
              : template.is_preview
                ? t('diary.picker.preview')
                : t('diary.picker.plus')}
          </Text>
        </View>

        <PressableRing
          role="button"
          aria-pressed={favorite}
          aria-label={t(favorite ? 'habits.favorite.remove' : 'habits.favorite.add', {
            title: template.title,
          })}
          onPress={() => onToggleFavorite(!favorite)}
          style={[styles.star, favorite && styles.starOn]}
        >
          <Text style={[styles.starGlyph, favorite && styles.starGlyphOn]}>
            {favorite ? '★' : '☆'}
          </Text>
        </PressableRing>
      </View>

      {template.description_md ? (
        <Text style={styles.description} numberOfLines={open ? undefined : 5}>
          {template.description_md}
        </Text>
      ) : null}

      {open ? (
        <View style={styles.facts}>
          <Fact label={t('habits.details.category')} value={category.title} />
          <Fact label={t('habits.details.entry')} value={entryKind} />
          <Fact label={t('habits.details.points')} value={pointsText} />
        </View>
      ) : null}

      <View style={styles.rowLinks}>
        <PressableRing
          // role ausdruecklich: ohne sie macht react-native-web ein <div>
          // daraus, und aria-expanded haette fuer Screenreader keinen Halt.
          role="button"
          onPress={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={t(open ? 'habits.details.hide' : 'habits.details.show', { title: template.title })}
          style={styles.detailsToggle}
        >
          <Text style={styles.detailsToggleText}>
            {open ? t('habits.details.hideShort') : t('habits.details.showShort')}
          </Text>
        </PressableRing>
        {template.exercise_id ? (
          <Link href={`/sessions/${template.exercise_id}`} style={styles.editLink}>
            {t('habits.details.session')}
          </Link>
        ) : (
          <HabitLinkButton
            url={template.link_url}
            sessionLabel={t('habits.details.session')}
            linkLabel={t('habits.details.link')}
            style={styles.editLink}
          />
        )}
        {own ? (
          <Link
            href={{
              pathname: '/habit-tracker/eigenes-habit',
              params: { id: template.id },
            }}
            style={styles.editLink}
          >
            {t('habits.edit')}
          </Link>
        ) : null}
      </View>

      <View style={styles.rowFoot}>
        {locked && !chosen ? (
          <Link href="/plus" style={styles.plusLink}>
            {t('diary.picker.toPlus')}
          </Link>
        ) : (
          <PressableRing
            onPress={() => onChoose(!chosen)}
            disabled={pending}
            style={[styles.action, chosen && styles.actionOn]}
          >
            <Text style={[styles.actionText, chosen && styles.actionTextOn]}>
              {chosen ? t('diary.picker.remove') : t('diary.picker.add')}
            </Text>
          </PressableRing>
        )}
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const badge = {
  alignSelf: 'flex-start',
  fontSize: 11,
  fontWeight: '600',
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: radius.full,
} as const;

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryText: {
    fontSize: 13,
    color: colors.ink700,
  },
  // Mobil eine Karte je Reihe; ab dem Breakpoint setzt responsive.ts die
  // Breite (habits-grid).
  row: {
    flexGrow: 0,
    flexBasis: '100%',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontSize: 11,
    color: colors.ink700,
  },
  metaPositive: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.sage700,
  },
  metaNegative: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.danger,
  },
  rowFoot: {
    // Unten in der Karte, auch wenn die Nachbarkarte laenger ist.
    marginTop: 'auto',
    flexDirection: 'row',
    paddingTop: 4,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowTitle: {
    flex: 1,
    gap: 4,
  },
  rowLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailsToggle: {
    paddingVertical: 2,
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  facts: {
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  fact: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  factLabel: {
    width: 110,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink700,
  },
  factValue: {
    flex: 1,
    fontSize: 13,
    color: colors.ink700,
  },
  star: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  starOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  starGlyph: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.ink700,
  },
  starGlyphOn: {
    color: colors.ocean700,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  badgePreview: {
    ...badge,
    color: colors.sage700,
    backgroundColor: colors.sageTint,
  },
  badgePlus: {
    ...badge,
    color: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  badgeOwn: {
    ...badge,
    color: colors.ink700,
    backgroundColor: colors.background,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
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
