import { Link, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { MOBILE_NAV_BREAKPOINT, MOBILE_TAB_BAR_HEIGHT, navItems, type NavIcon } from '@/design/navigation';

// Handgebaute Liniensymbole statt Emoji (craft-floor: kein Unicode/Emoji als
// Icon) und statt einer neuen SVG-Bibliothek (CLAUDE.md: keine neue
// Abhaengigkeit ohne Ruecksprache) - reine View-Formen, 1.6-1.8px "Strich".
function NavGlyph({ icon, color }: { icon: NavIcon; color: string }) {
  switch (icon) {
    case 'news':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.newsRing, { borderColor: color }]} />
          <View style={[styles.newsDot, { backgroundColor: color }]} />
        </View>
      );
    case 'kurse':
      return (
        <View style={[styles.glyphBox, styles.kurseGlyph]}>
          <View style={[styles.kurseBar, { backgroundColor: color, width: 18 }]} />
          <View style={[styles.kurseBar, { backgroundColor: color, width: 18 }]} />
          <View style={[styles.kurseBar, { backgroundColor: color, width: 11 }]} />
        </View>
      );
    case 'uebungen':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.uebungenRing, { borderColor: color }]} />
        </View>
      );
    case 'team':
      return (
        <View style={[styles.glyphBox, styles.teamGlyph]}>
          <View style={[styles.teamHead, { backgroundColor: color }]} />
          <View style={[styles.teamBody, { backgroundColor: color }]} />
        </View>
      );
    case 'konto':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.kontoRing, { borderColor: color }]}>
            <View style={[styles.kontoHead, { backgroundColor: color }]} />
            <View style={[styles.kontoBody, { backgroundColor: color }]} />
          </View>
        </View>
      );
  }
}

export function NavBar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= MOBILE_NAV_BREAKPOINT;

  return (
    <>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>thehacode</Text>
        {isDesktop ? (
          <View style={styles.pillRow}>
            {navItems.map((item) => {
              if (item.kind === 'comingSoon') {
                return (
                  <Text key={item.key} style={styles.comingSoon}>
                    {t(item.labelKey)} · {t('nav.comingSoon')}
                  </Text>
                );
              }
              const active = item.href === pathname;
              return (
                <Link key={item.key} href={item.href}>
                  <View style={[styles.pill, active && styles.pillActive]}>
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{t(item.labelKey)}</Text>
                  </View>
                </Link>
              );
            })}
          </View>
        ) : null}
      </View>

      {isDesktop ? null : (
        <View style={styles.mobileTabBar}>
          {navItems.map((item) => {
            const active = item.kind === 'link' && item.href === pathname;
            const color = active ? colors.ocean700 : colors.ink700;
            const content = (
              <>
                <NavGlyph icon={item.icon} color={color} />
                <Text
                  style={[styles.tabLabel, { color }, active && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {t(item.labelKey)}
                </Text>
              </>
            );
            if (item.kind === 'comingSoon') {
              return (
                <View key={item.key} style={styles.tabItem}>
                  {content}
                </View>
              );
            }
            return (
              <Link key={item.key} href={item.href} style={styles.tabItem}>
                {content}
              </Link>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
    letterSpacing: 0.2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillActive: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  pillText: {
    fontSize: 13,
    color: colors.ink700,
  },
  pillTextActive: {
    color: colors.surface,
    fontWeight: '500',
  },
  comingSoon: {
    fontSize: 13,
    color: colors.ink700,
    opacity: 0.5,
  },

  // Mobile Tab-Bar - fixed unten, react-native-web unterstuetzt das, RNs
  // Style-Typen (nur nativ gedacht) kennen 'fixed' nicht.
  mobileTabBar: {
    position: 'fixed' as 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: MOBILE_TAB_BAR_HEIGHT,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    zIndex: 10,
  },
  // flex: 1 verteilt beliebig viele Eintraege gleichmaessig - aktuell 5
  // (News, Kurse, Uebungen, Team, Konto), minWidth 0 verhindert, dass ein
  // langes Label ("Uebungen") den Nachbarn Platz wegnimmt.
  tabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '600',
  },

  glyphBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsRing: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 1.6,
  },
  newsDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  kurseGlyph: {
    gap: 3,
  },
  kurseBar: {
    height: 2,
    borderRadius: 1,
  },
  uebungenRing: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    borderWidth: 1.8,
  },
  teamGlyph: {
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  teamHead: {
    width: 9,
    height: 9,
    borderRadius: radius.full,
    marginBottom: 2,
  },
  teamBody: {
    width: 17,
    height: 9,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  // Konto: Kopf+Schultern wie teamHead/-Body, aber innerhalb eines Rings
  // (overflow: hidden) freigestellt - das klassische Profil-in-Kreis-Symbol,
  // optisch von "Team" (frei stehende Figur) unterscheidbar.
  kontoRing: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    borderWidth: 1.6,
    alignItems: 'center',
    overflow: 'hidden',
  },
  kontoHead: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginTop: 3,
  },
  kontoBody: {
    width: 13,
    height: 8,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    marginTop: 1,
  },
});
