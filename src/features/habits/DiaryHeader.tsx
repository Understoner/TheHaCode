import { Link, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { InfoButton } from '@/components/InfoButton';
import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

// Die Ueberschrift des Tagebuchs mit drei Symbolen rechts daneben
// (30.10.2026): Auswertung, Einstellungen, Info. Die Erklaerung, die bis
// dahin als Absatz unter dem Titel stand, liegt jetzt hinter dem "i" - der
// Tag rueckt damit auf dem Handy eine Bildschirmhoehe naeher nach oben.
//
// Die Kreise sind so hoch wie die Schrift der Ueberschrift (28), die
// Trefferflaeche ueber hitSlop trotzdem 44. Gezeichnet mit react-native-svg
// wie die Diagramme in charts.tsx - das Projekt hat keine Icon-Bibliothek
// (siehe FavoriteStar.tsx).

const TITLE_SIZE = 28;
const GLYPH = 16;

export function DiaryHeader() {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Text role="heading" style={styles.title}>
        {t('diary.title')}
      </Text>
      <View style={styles.icons}>
        <IconLink href="/habit-tracker/auswertung" label={t('diary.header.insights')}>
          <ChartGlyph />
        </IconLink>
        <IconLink href="/habit-tracker/einstellungen" label={t('diary.header.settings')}>
          <GearGlyph />
        </IconLink>
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

function IconLink({ href, label, children }: { href: Href; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} asChild>
      <PressableRing role="link" aria-label={label} hitSlop={8} style={styles.icon}>
        {children}
      </PressableRing>
    </Link>
  );
}

/** Drei Balken auf einer Grundlinie. */
function ChartGlyph() {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      <Rect x={2} y={8} width={3} height={6} rx={1} fill={colors.ink700} />
      <Rect x={6.5} y={3} width={3} height={11} rx={1} fill={colors.ink700} />
      <Rect x={11} y={6} width={3} height={8} rx={1} fill={colors.ink700} />
    </Svg>
  );
}

/** Ein Zahnrad: Ring mit acht Zaehnen. */
function GearGlyph() {
  const teeth = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 16 16">
      {teeth.map((a) => (
        <Line
          key={a}
          x1={8 + Math.cos(a) * 4.5}
          y1={8 + Math.sin(a) * 4.5}
          x2={8 + Math.cos(a) * 7}
          y2={8 + Math.sin(a) * 7}
          stroke={colors.ink700}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={8} cy={8} r={4.2} fill="none" stroke={colors.ink700} strokeWidth={2.4} />
    </Svg>
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
    fontSize: TITLE_SIZE,
    fontWeight: '600',
    color: colors.ink900,
  },
  // 16 Abstand: genau so viel, dass sich die hitSlop-Flaechen (je 8) nicht
  // ueberlappen.
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Gleiche Form wie das kompakte InfoButton daneben.
  icon: {
    width: TITLE_SIZE,
    height: TITLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
