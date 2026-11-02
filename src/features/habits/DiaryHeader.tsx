import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  ChartGlyph,
  ChecklistGlyph,
  PathGlyph,
  GearGlyph,
  HEADER_ICON_GAP,
  HEADER_ICON_SIZE,
  HeaderIconLink,
} from '@/components/HeaderIcon';
import { InfoButton } from '@/components/InfoButton';
import { PressableRing } from '@/components/PressableRing';
import { responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';

// Die Ueberschrift des Tagebuchs mit Symbolen rechts daneben (30.10.2026):
// Habit-Auswahl, Auswertung, Einstellungen, Info. Die Erklaerung, die bis
// dahin als Absatz unter dem Titel stand, liegt jetzt hinter dem "i" - der
// Tag rueckt damit auf dem Handy eine Bildschirmhoehe naeher nach oben.
//
// Die Knoepfe selbst stehen in src/components/HeaderIcon.tsx - dieselben
// sitzen inzwischen auch neben Kurse, Sessions und Habit-Auswahl.

export function DiaryHeader() {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Text role="heading" style={styles.title}>
        {t('diary.title')}
      </Text>
      <View {...responsive('header-icons')} style={styles.icons}>
        <HeaderIconLink href="/habit-tracker/auswahl" label={t('diary.header.picker')}>
          <ChecklistGlyph />
        </HeaderIconLink>
        <HeaderIconLink href="/habit-tracker/challenges" label={t('diary.header.challenges')}>
          <PathGlyph />
        </HeaderIconLink>
        <HeaderIconLink href="/habit-tracker/auswertung" label={t('diary.header.insights')}>
          <ChartGlyph />
        </HeaderIconLink>
        <HeaderIconLink href="/habit-tracker/einstellungen" label={t('diary.header.settings')}>
          <GearGlyph />
        </HeaderIconLink>
        <InfoButton
          kompakt
          label={t('diary.header.info')}
          titel={t('diary.info.title')}
          abschnitte={[
            { titel: t('diary.info.habits.title'), text: t('diary.intro') },
            { titel: t('diary.info.days.title'), text: t('diary.info.days.text') },
            { titel: t('diary.info.more.title'), text: t('diary.info.more.text') },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: HEADER_ICON_SIZE,
    fontWeight: '600',
    color: colors.ink900,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HEADER_ICON_GAP,
  },
});

// ---------------------------------------------------------------------------
// Testsystem (02.11.2026, Vorschlag "Mondlicht Mobile"): statt fuenf
// unbeschrifteter Symbole ein Knopf "…", der ein kleines Menue mit
// beschrifteten Eintraegen oeffnet. Die Auswertung ist dort kein Eintrag mehr,
// sie ist die dritte Ansicht im Umschalter darunter.
// ---------------------------------------------------------------------------

export type DiaryView = 'heute' | 'woche' | 'auswertung';

export const DIARY_VIEWS: DiaryView[] = ['heute', 'woche', 'auswertung'];

export function parseDiaryView(raw: string | string[] | undefined): DiaryView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (DIARY_VIEWS as string[]).includes(value ?? '') ? (value as DiaryView) : 'heute';
}

export function DiaryHeaderMenu({ view, onChangeView }: { view: DiaryView; onChangeView: (view: DiaryView) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/habit-tracker/auswahl', label: t('diary.header.picker') },
    { href: '/habit-tracker/challenges', label: t('diary.header.challenges') },
    { href: '/habit-tracker/einstellungen', label: t('diary.header.settings') },
  ] as const;

  return (
    <View style={menuStyles.wrap}>
      <View style={styles.row}>
        <Text role="heading" style={styles.title}>
          {t('diary.title')}
        </Text>
        <InfoButton
          kompakt
          label={t('diary.header.info')}
          titel={t('diary.info.title')}
          abschnitte={[
            { titel: t('diary.info.habits.title'), text: t('diary.intro') },
            { titel: t('diary.info.days.title'), text: t('diary.info.days.text') },
            { titel: t('diary.info.more.title'), text: t('diary.info.more.text') },
          ]}
        />
        <PressableRing
          onPress={() => setOpen((v) => !v)}
          role="button"
          aria-expanded={open}
          accessibilityLabel={t('diary.header.menu')}
          style={menuStyles.moreButton}
        >
          <Text aria-hidden style={menuStyles.moreGlyph}>
            •••
          </Text>
        </PressableRing>
      </View>

      {open ? (
        <View style={menuStyles.menu}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} style={menuStyles.menuItem} onPress={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </View>
      ) : null}

      <View role="tablist" aria-label={t('diary.view.label')} style={menuStyles.tabs}>
        {DIARY_VIEWS.map((v) => {
          const on = v === view;
          return (
            <PressableRing
              key={v}
              onPress={() => onChangeView(v)}
              role="tab"
              aria-selected={on}
              style={[menuStyles.tab, on && menuStyles.tabOn]}
            >
              <Text style={[menuStyles.tabText, on && menuStyles.tabTextOn]}>{t(`diary.view.${v}`)}</Text>
            </PressableRing>
          );
        })}
      </View>
    </View>
  );
}

const menuStyles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreGlyph: {
    fontSize: 12,
    letterSpacing: 1,
    color: colors.ink700,
  },
  menu: {
    alignSelf: 'flex-end',
    minWidth: 220,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  menuItem: {
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink900,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  tabOn: {
    backgroundColor: colors.ocean700,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink700,
  },
  tabTextOn: {
    color: colors.surface,
  },
});
