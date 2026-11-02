import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';

import { diaryErrorKey } from './diaryErrors';
import { HabitLinkButton } from './HabitLinkButton';
import { filterTemplates, groupByCategory, isOwn, type HabitFilter } from './habitFilter';
import {
  useChooseHabit,
  useToggleHabitFavorite,
  type HabitCategory,
  type HabitTemplate,
  type MyHabit,
} from './useHabits';

// Die Habit-Auswahl im Vorschlag "Mondlicht Mobile" (02.11.2026, nur
// Testsystem): Suche oben, die Bereiche als wischbare Symbolleiste, kompakte
// Zeilen - Beschreibung und Verweise erst auf Tipp. Aufnehmen, Herausnehmen,
// Merken und die Plus-Sperre laufen ueber dieselben Hooks und Regeln wie in
// HabitCatalog.tsx (die Sperre selbst sitzt in der Datenbank).

const AREA_ICON: Record<string, string> = {
  atmung: 'M12 3c-4 5-4 11 0 18M12 3c4 5 4 11 0 18M4 12c4-2 12-2 16 0',
  schlaf: 'M17 3a9 9 0 1 0 4 13A7 7 0 0 1 17 3z',
  bewegung: 'M13 4a2 2 0 1 0 0.01 0M7 21l3-6 3 2v4M10 15l1-5 4 2 3-1M8 10l3-1',
  muskeltraining: 'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
  ernaehrung: 'M12 8c-4-4-9 0-7 5s5 8 7 8 5-3 7-8-3-9-7-5zM12 8c0-2 1-4 3-5',
  fasten: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 7v5l3 3',
  stressmanagement: 'M3 10c3-3 6-3 9 0s6 3 9 0M3 16c3-3 6-3 9 0s6 3 9 0',
};
const FALLBACK_ICON = 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z';

export function AreaGlyph({ slug, color, size = 22 }: { slug: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={AREA_ICON[slug] ?? FALLBACK_ICON}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HabitPicker({
  categories,
  templates,
  myHabits,
  favorites,
  plusAccess,
  filter,
}: {
  categories: HabitCategory[];
  templates: HabitTemplate[];
  myHabits: MyHabit[];
  favorites: ReadonlySet<string>;
  plusAccess: boolean;
  filter: HabitFilter;
}) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const choose = useChooseHabit();
  const toggleFavorite = useToggleHabitFavorite();
  const [query, setQuery] = useState(filter.query);
  const [areaId, setAreaId] = useState<string | null>(filter.categoryId ?? categories[0]?.id ?? null);
  const [open, setOpen] = useState<string | null>(null);
  const chosen = new Set(myHabits.filter((h) => h.is_active).map((h) => h.template_id));

  // Mit Suchwort ueber alle Bereiche, sonst nur der gewaehlte.
  const searching = query.trim() !== '';
  const groups = useMemo(
    () =>
      groupByCategory(
        categories,
        filterTemplates(templates, { ...filter, query, categoryId: searching ? null : areaId }, favorites),
        favorites,
      ),
    [categories, templates, filter, query, searching, areaId, favorites],
  );
  const area = categories.find((c) => c.id === areaId) ?? null;
  const error = choose.error ?? toggleFavorite.error;

  return (
    <View style={styles.stack}>
      <View style={styles.search}>
        <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
          <Path d="M11 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12zM20 20l-4.5-4.5" fill="none" stroke={palette.ink700} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <TextInput
          value={query}
          onChangeText={setQuery}
          aria-label={t('habits.picker.search')}
          placeholder={t('habits.picker.search')}
          placeholderTextColor={palette.ink700}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areas}>
        {categories.map((c) => {
          const on = !searching && c.id === areaId;
          return (
            <PressableRing
              key={c.id}
              onPress={() => {
                setAreaId(c.id);
                setQuery('');
                setOpen(null);
              }}
              role="button"
              aria-pressed={on}
              style={[styles.area, on && styles.areaOn]}
            >
              <AreaGlyph slug={c.slug} color={on ? palette.surface : palette.ink900} />
              <Text numberOfLines={1} style={[styles.areaText, on && styles.areaTextOn]}>
                {c.title}
              </Text>
            </PressableRing>
          );
        })}
      </ScrollView>

      <View style={styles.head}>
        <Text role="heading" aria-level={2} style={styles.headTitle}>
          {searching ? t('habits.picker.results') : (area?.title ?? '')}
        </Text>
        <Text style={styles.headCount}>{t('habits.picker.inDiary', { count: chosen.size })}</Text>
      </View>

      {error ? (
        <Text role="alert" style={styles.error}>
          {t(diaryErrorKey(error))}
        </Text>
      ) : null}

      {groups.length === 0 ? (
        <StateMessage title={t('habits.empty.title')} body={t('habits.empty.hint')} />
      ) : (
        groups.map(({ category, templates: list }) => (
          <View key={category.id} style={styles.rows}>
            {searching ? <Text style={styles.groupLabel}>{category.title}</Text> : null}
            {list.map((template) => (
              <PickerRow
                key={template.id}
                template={template}
                category={category}
                chosen={chosen.has(template.id)}
                favorite={favorites.has(template.id)}
                locked={!template.is_preview && !plusAccess}
                open={open === template.id}
                pending={choose.isPending}
                onToggleOpen={() => setOpen(open === template.id ? null : template.id)}
                onToggleFavorite={(fav) => toggleFavorite.mutate({ templateId: template.id, favorite: fav })}
                onChoose={(value) =>
                  choose.mutate({ templateId: template.id, chosen: value, sortOrder: template.sort_order })
                }
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function PickerRow({
  template,
  category,
  chosen,
  favorite,
  locked,
  open,
  pending,
  onToggleOpen,
  onToggleFavorite,
  onChoose,
}: {
  template: HabitTemplate;
  category: HabitCategory;
  chosen: boolean;
  favorite: boolean;
  locked: boolean;
  open: boolean;
  pending: boolean;
  onToggleOpen: () => void;
  onToggleFavorite: (favorite: boolean) => void;
  onChoose: (chosen: boolean) => void;
}) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const own = isOwn(template);
  const negative = template.is_negative || category.is_negative;
  const points =
    template.tracking_type === 'number'
      ? t('habits.picker.measure', { unit: template.unit ?? '' }).trim()
      : `${negative ? '−' : '+'}${template.points}`;

  return (
    <View style={[styles.row, chosen && styles.rowChosen]}>
      <View style={styles.rowLine}>
        <PressableRing
          onPress={onToggleOpen}
          role="button"
          aria-expanded={open}
          accessibilityLabel={t(open ? 'habits.details.hide' : 'habits.details.show', { title: template.title })}
          style={styles.rowMain}
        >
          <View style={styles.rowIcon}>
            <AreaGlyph slug={category.slug} color={palette.ocean700} size={18} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{template.title}</Text>
            <View style={styles.rowMeta}>
              <Text
                style={
                  template.tracking_type === 'number' ? styles.metaNeutral : negative ? styles.metaNegative : styles.metaPositive
                }
              >
                {points}
              </Text>
              {own ? (
                <Text style={styles.metaBadge}>· {t('habits.badge.own')}</Text>
              ) : !template.is_preview ? (
                <Text style={styles.metaBadge}>· {t('diary.picker.plus')}</Text>
              ) : null}
            </View>
          </View>
        </PressableRing>

        {locked && !chosen ? (
          <Link href="/plus" aria-label={t('diary.picker.toPlus')} style={styles.addButton}>
            <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
              <Path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke={palette.ocean700} strokeWidth={1.8} strokeLinejoin="round" />
            </Svg>
          </Link>
        ) : (
          <PressableRing
            onPress={() => onChoose(!chosen)}
            disabled={pending}
            role="button"
            aria-pressed={chosen}
            accessibilityLabel={t(chosen ? 'habits.picker.remove' : 'habits.picker.add', { title: template.title })}
            style={[styles.addButton, chosen && styles.addButtonOn]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
              <Path
                d={chosen ? 'M5 12.5l4.5 4.5L19 7.5' : 'M12 5v14M5 12h14'}
                fill="none"
                stroke={chosen ? palette.surface : palette.ocean700}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </PressableRing>
        )}
      </View>

      {open ? (
        <View style={styles.details}>
          {template.description_md ? <Text style={styles.description}>{template.description_md}</Text> : null}
          <View style={styles.detailLinks}>
            <PressableRing
              onPress={() => onToggleFavorite(!favorite)}
              role="button"
              aria-pressed={favorite}
              style={styles.detailButton}
            >
              <Text style={styles.detailLink}>
                {t(favorite ? 'habits.picker.unfavorite' : 'habits.picker.favorite')}
              </Text>
            </PressableRing>
            {template.exercise_id ? (
              <Link href={`/sessions/${template.exercise_id}`} style={styles.detailLink}>
                {t('habits.details.session')}
              </Link>
            ) : (
              <HabitLinkButton
                url={template.link_url}
                sessionLabel={t('habits.details.session')}
                linkLabel={t('habits.details.link')}
                style={styles.detailLink}
              />
            )}
            {own ? (
              <Link href={{ pathname: '/habit-tracker/eigenes-habit', params: { id: template.id } }} style={styles.detailLink}>
                {t('habits.edit')}
              </Link>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    maxWidth: 720,
    width: '100%',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    // 16 px: darunter zoomt iOS Safari beim Antippen in die Seite (HabitDay.tsx).
    fontSize: 16,
    paddingVertical: 10,
    color: colors.ink900,
  },
  areas: {
    gap: spacing.sm,
  },
  area: {
    minWidth: 74,
    minHeight: 70,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  areaOn: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  areaText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink900,
  },
  areaTextOn: {
    color: colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  headCount: {
    fontSize: 12,
    color: colors.ink700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  rows: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  row: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  rowChosen: {
    borderColor: colors.ocean700,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingLeft: 4,
    paddingRight: 8,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oceanTint,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: colors.ink900,
  },
  rowMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 3,
  },
  metaPositive: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.sage700,
  },
  metaNegative: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
  },
  metaNeutral: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink700,
  },
  metaBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ocean700,
  },
  addButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
  },
  addButtonOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
  },
  details: {
    gap: spacing.sm,
    paddingLeft: 58,
    paddingRight: 14,
    paddingBottom: 14,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  detailLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  detailLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ocean700,
  },
});
