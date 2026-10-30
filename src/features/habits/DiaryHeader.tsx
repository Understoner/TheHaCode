import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  ChartGlyph,
  ChecklistGlyph,
  GearGlyph,
  HEADER_ICON_GAP,
  HEADER_ICON_SIZE,
  HeaderIconLink,
} from '@/components/HeaderIcon';
import { InfoButton } from '@/components/InfoButton';
import { responsive } from '@/design/responsive';
import { colors, spacing } from '@/design/tokens';

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
