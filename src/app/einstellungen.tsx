import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { setTheme, useThemeName } from '@/design/theme';
import { colors, DESIGN_PREVIEW, palettes, radius, spacing, type ThemeName } from '@/design/tokens';

// Einstellungen der App (01.11.2026, nur Testsystem): die Darstellung.
// Klar ist das bisherige Design, Mondlicht die verspielte Alternative.
// Gespeichert im Geraet - Begruendung in src/design/theme.ts.

const OPTIONS: ThemeName[] = ['klar', 'mondlicht'];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const current = useThemeName();

  if (!DESIGN_PREVIEW) {
    return (
      <StateMessage
        title={t('settings.unavailable.title')}
        body={t('settings.unavailable.hint')}
        actionLabel={t('settings.back')}
        onAction={() => router.replace('/')}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.column}>
        <Link href="/" style={styles.back}>
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </Link>
        <Text role="heading" aria-level={1} style={styles.title}>
          {t('settings.title')}
        </Text>

        <View style={styles.section}>
          <Text role="heading" aria-level={2} style={styles.sectionTitle}>
            {t('settings.look.title')}
          </Text>
          <Text style={styles.hint}>{t('settings.look.hint')}</Text>
          <View role="radiogroup" aria-label={t('settings.look.title')} style={styles.options}>
            {OPTIONS.map((name) => {
              const selected = current === name;
              return (
                <PressableRing
                  key={name}
                  role="radio"
                  aria-checked={selected}
                  onPress={() => setTheme(name)}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <Swatch name={name} />
                  <Text style={styles.optionTitle}>{t(`settings.look.${name}.title`)}</Text>
                  <Text style={styles.optionText}>{t(`settings.look.${name}.text`)}</Text>
                </PressableRing>
              );
            })}
          </View>
          <Text style={styles.hint}>{t('settings.look.preview')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/** Eine Miniatur der Darstellung: Grund, Karte, Knopf. Feste Werte der Palette, damit beide nebeneinander stimmen. */
function Swatch({ name }: { name: ThemeName }) {
  const p = palettes[name];
  const round = name === 'mondlicht' ? 14 : 6;
  return (
    <View aria-hidden style={[styles.swatch, { backgroundColor: p.background, borderRadius: round }]}>
      <View style={[styles.swatchLine, { backgroundColor: p.ink900 }]} />
      <View style={[styles.swatchCard, { backgroundColor: p.surface, borderColor: p.line, borderRadius: round }]}>
        <View style={[styles.swatchDot, { borderColor: p.glow }]} />
        <View style={[styles.swatchText, { backgroundColor: p.ink700 }]} />
      </View>
      <View style={[styles.swatchButton, { backgroundColor: p.ocean700 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingVertical: spacing.xl,
  },
  column: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    display: 'flex',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 15,
    color: colors.ocean700,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.ink900,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink700,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  option: {
    flexGrow: 1,
    flexBasis: 160,
    padding: 10,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.ocean700,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink900,
  },
  optionText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink700,
  },
  swatch: {
    height: 104,
    padding: 10,
    gap: 8,
    overflow: 'hidden',
  },
  swatchLine: {
    width: '45%',
    height: 7,
    borderRadius: 2,
  },
  swatchCard: {
    height: 36,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  swatchDot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  swatchText: {
    width: '50%',
    height: 5,
    borderRadius: 2,
  },
  swatchButton: {
    width: '50%',
    height: 14,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
});
