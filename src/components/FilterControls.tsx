import { Link, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';

// Bausteine der Filterseiten (30.10.2026): Die Filter sitzen nicht mehr als
// Chips ueber den Listen, sondern auf einer eigenen Seite hinter einem
// Trichter neben der Ueberschrift. Was gefiltert ist, steht dann in einer
// Zeile unter der Ueberschrift - sonst saehe man der Liste nicht an, dass
// etwas fehlt.

/** Eine waehlbare Zeile auf einer Filterseite. */
export function FilterOption({
  label,
  selected,
  onPress,
  tone,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Farbpunkt vor der Beschriftung, etwa die Farbe eines Wirkeffekts. */
  tone?: string;
}) {
  return (
    <PressableRing
      onPress={onPress}
      role="radio"
      aria-checked={selected}
      style={[styles.option, selected && styles.optionSelected]}
    >
      {tone ? <View style={[styles.dot, { backgroundColor: tone }]} /> : null}
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {/* Steht immer da, damit die Zeile nicht springt - fuer Screenreader
          aber ausgeblendet: die Auswahl sagt aria-checked an. */}
      <Text aria-hidden style={[styles.check, !selected && styles.checkHidden]}>
        ✓
      </Text>
    </PressableRing>
  );
}

/** Ueberschrift einer Optionsgruppe mit den Optionen darunter. */
export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group} role="radiogroup" aria-label={title}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * "Gefiltert: Dieser Monat  ×" unter einer Ueberschrift. Das Kreuz fuehrt auf
 * die ungefilterte Liste.
 */
export function ActiveFilter({ summary, resetHref }: { summary: string; resetHref: Href }) {
  const { t } = useTranslation();
  return (
    <View style={styles.active}>
      <Text style={styles.activeText} numberOfLines={2}>
        {t('filter.active', { summary })}
      </Text>
      <Link href={resetHref} replace asChild>
        <PressableRing role="link" aria-label={t('filter.reset')} hitSlop={8} style={styles.reset}>
          <Text style={styles.resetText}>×</Text>
        </PressableRing>
      </Link>
    </View>
  );
}

export const filterPageStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
});

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.ink900,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.ocean700,
  },
  check: {
    fontSize: 16,
    color: colors.ocean700,
  },
  checkHidden: {
    opacity: 0,
  },
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  activeText: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.ocean700,
  },
  reset: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 16,
    lineHeight: 18,
    color: colors.ocean700,
  },
});
