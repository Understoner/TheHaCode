import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { displayFont, responsive } from '@/design/responsive';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';

// Was es ohne Konto, mit kostenlosem Konto und mit Plus gibt (02.11.2026,
// nur Testsystem) - fuer Gaeste im Tagebuch und auf der Kontoseite.
//
// Nur, was es wirklich gibt: keine Preise hier (die kommen aus Stripe und
// stehen auf /plus), kein Testzeitraum (CLAUDE.md §Zugriff), keine Zahl,
// die sich mit den Vorlagen aendern koennte.

type Tier = 'frei' | 'konto' | 'plus';

const TIERS: { key: Tier; items: string[]; href?: string; action?: string }[] = [
  { key: 'frei', items: ['sessions', 'konfigurator', 'kurse'] },
  { key: 'konto', items: ['favoriten', 'bolt', 'auswertung', 'score'], href: '/konto?modus=registrieren', action: 'register' },
  { key: 'plus', items: ['sequenzen', 'vorlagen', 'eigene', 'wege', 'auto', 'bleibt'], href: '/plus', action: 'plus' },
];

const CHECK = 'M5 12.5l4.5 4.5L19 7.5';

export function PlanTiers({ hideRegister = false }: { hideRegister?: boolean }) {
  const { t } = useTranslation();
  const palette = useThemePalette();

  return (
    <View style={styles.wrap}>
      <Text role="heading" aria-level={2} {...displayFont} style={styles.heading}>
        {t('guest.tiers.title')}
      </Text>
      <View {...responsive('m-grid')} style={styles.grid}>
        {TIERS.map((tier) => {
          const plus = tier.key === 'plus';
          const showAction = tier.href && !(hideRegister && tier.key === 'konto');
          return (
            <View key={tier.key} style={[styles.card, plus && styles.cardPlus]}>
              <Text style={[styles.kicker, plus && styles.kickerPlus]}>{t(`guest.tiers.${tier.key}.kicker`)}</Text>
              <Text {...displayFont} style={styles.name}>
                {t(`guest.tiers.${tier.key}.name`)}
              </Text>
              {tier.key !== 'frei' ? <Text style={styles.more}>{t(`guest.tiers.${tier.key}.more`)}</Text> : null}
              <View style={styles.items}>
                {tier.items.map((item) => (
                  <View key={item} style={styles.item}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden style={styles.check}>
                      <Path d={CHECK} fill="none" stroke={plus ? palette.ocean700 : palette.sage700} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.itemText}>{t(`guest.tiers.${tier.key}.${item}`)}</Text>
                  </View>
                ))}
              </View>
              {showAction ? (
                <Link href={tier.href as never} style={[styles.action, plus && styles.actionPlus]}>
                  {t(`guest.tiers.action.${tier.action}`)}
                </Link>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 24,
    lineHeight: 29,
    color: colors.ink900,
  },
  grid: {
    gap: spacing.sm,
  },
  card: {
    gap: 6,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardPlus: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanImageBg,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.sage700,
  },
  kickerPlus: {
    color: colors.ocean700,
  },
  name: {
    fontSize: 22,
    lineHeight: 27,
    color: colors.ink900,
  },
  more: {
    fontSize: 13,
    color: colors.ink700,
  },
  items: {
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  item: {
    flexDirection: 'row',
    gap: 8,
  },
  check: {
    marginTop: 2,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink900,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 'auto',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ocean700,
    textDecorationLine: 'none',
  },
  actionPlus: {
    backgroundColor: colors.ocean700,
    color: colors.background,
  },
});
