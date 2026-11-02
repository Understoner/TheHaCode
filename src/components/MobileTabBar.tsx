import { Link, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { MOBILE_TAB_BAR_SAFE_HEIGHT } from '@/design/navigation';
import { responsive } from '@/design/responsive';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';

// Die Tab-Leiste des Vorschlags "Mondlicht Mobile" (02.11.2026, nur
// Testsystem): fuenf statt sechs Eintraege - Start, Atmen, Tagebuch, Kurse,
// Mehr. "Mehr" oeffnet ein Blatt mit News, Team, Konto, Einstellungen und den
// Rechtstexten; der Fussstreifen mit den Rechtstexten faellt auf dem Handy
// dafuer weg (_layout.tsx). Aktiv heisst: goldener Mond-Punkt unter der
// Beschriftung statt einer Leiste oben.
//
// SVG-Farben als Hex aus der Palette - als SVG-Attribut loest nicht jeder
// Browser var() sicher auf (wie Lotus.tsx).

type TabIcon = 'start' | 'atmen' | 'tagebuch' | 'kurse';

const TABS: { key: TabIcon; labelKey: string; href: Href; match: (path: string) => boolean }[] = [
  { key: 'start', labelKey: 'nav.start', href: '/', match: (p) => p === '/' },
  {
    key: 'atmen',
    labelKey: 'nav.atmen',
    href: '/sessions',
    match: (p) => p === '/sessions' || p.startsWith('/sessions/') || p.startsWith('/sequenzen'),
  },
  { key: 'tagebuch', labelKey: 'nav.tagebuch', href: '/habit-tracker', match: (p) => p.startsWith('/habit-tracker') },
  { key: 'kurse', labelKey: 'nav.kurse', href: '/kurse', match: (p) => p.startsWith('/kurse') },
];

const MORE_PATHS = ['/news', '/team', '/konto', '/einstellungen', '/plus', '/impressum', '/datenschutz', '/agb', '/haftungsausschluss'];

const LEGAL_LINKS = [
  { href: '/impressum', labelKey: 'footer.impressum' },
  { href: '/datenschutz', labelKey: 'footer.datenschutz' },
  { href: '/agb', labelKey: 'footer.agb' },
  { href: '/haftungsausschluss', labelKey: 'footer.haftungsausschluss' },
] as const;

function TabGlyph({ icon, color }: { icon: TabIcon | 'mehr'; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
      {icon === 'start' ? <Path d="M17 3a9 9 0 1 0 4 13A7 7 0 0 1 17 3z" {...stroke} /> : null}
      {icon === 'atmen' ? (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Path d="M12 4c-3 3-3 13 0 16M12 4c3 3 3 13 0 16" {...stroke} />
        </>
      ) : null}
      {icon === 'tagebuch' ? (
        <>
          <Path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2z" {...stroke} strokeLinejoin="round" />
          <Path d="M9.5 11l2 2 3.5-4" {...stroke} strokeLinejoin="round" />
        </>
      ) : null}
      {icon === 'kurse' ? (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={3} {...stroke} />
          <Path d="M4 10h16M9 3v4M15 3v4" {...stroke} />
        </>
      ) : null}
      {icon === 'mehr' ? (
        <>
          <Circle cx={5} cy={12} r={2} fill={color} />
          <Circle cx={12} cy={12} r={2} fill={color} />
          <Circle cx={19} cy={12} r={2} fill={color} />
        </>
      ) : null}
    </Svg>
  );
}

type MoreIcon = 'news' | 'team' | 'konto' | 'settings';

function MoreGlyph({ icon, color }: { icon: MoreIcon; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
      {icon === 'news' ? (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={3} {...stroke} />
          <Path d="M8 9h8M8 13h8M8 17h5" {...stroke} />
        </>
      ) : null}
      {icon === 'team' ? (
        <>
          <Circle cx={9} cy={8} r={3} {...stroke} />
          <Circle cx={17} cy={9} r={2.3} {...stroke} />
          <Path d="M3 20c.6-4 2.8-6 6-6s5.4 2 6 6M14 20c.4-2.6 1.6-4 3-4s2.6 1.4 3 4" {...stroke} />
        </>
      ) : null}
      {icon === 'konto' ? (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21c1-5 15-5 16 0" {...stroke} />
        </>
      ) : null}
      {icon === 'settings' ? (
        <>
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Path
            d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
            {...stroke}
          />
        </>
      ) : null}
    </Svg>
  );
}

/** Goldener Punkt unter dem aktiven Eintrag; bei den anderen unsichtbar, damit nichts springt. */
function ActiveDot({ on }: { on: boolean }) {
  return <View style={[styles.dot, on && styles.dotOn]} />;
}

export function MobileTabBar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const palette = useThemePalette();
  // Offen ist das Blatt nur auf der Seite, auf der es geoeffnet wurde: jeder
  // Seitenwechsel schliesst es - auch einer ueber einen Link darin.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

  const moreActive = open || MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const tiles: { key: MoreIcon; href: Href; labelKey: string; tone: string }[] = [
    { key: 'news', href: '/news', labelKey: 'nav.news', tone: palette.glow },
    { key: 'team', href: '/team', labelKey: 'nav.team', tone: palette.blossom },
    { key: 'konto', href: '/konto', labelKey: 'nav.konto', tone: palette.sage700 },
  ];

  return (
    <View {...responsive('nav-mobile')} style={styles.wrap}>
      {open ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.more.close')}
            onPress={() => setOpen(false)}
            style={styles.scrim}
          />
          <View role="dialog" aria-label={t('nav.more.title')} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.tileRow}>
              {tiles.map((tile) => (
                <Link key={tile.key} href={tile.href} style={styles.tile}>
                  <MoreGlyph icon={tile.key} color={tile.tone} />
                  <Text style={styles.tileText}>{t(tile.labelKey)}</Text>
                </Link>
              ))}
            </View>
            <Link href="/einstellungen" style={styles.settingsRow}>
              <MoreGlyph icon="settings" color={palette.ink700} />
              <Text style={styles.settingsText}>{t('nav.more.settings')}</Text>
            </Link>
            <View style={styles.legalRow}>
              {LEGAL_LINKS.map((link) => (
                <Link key={link.href} href={link.href} style={styles.legalLink}>
                  {t(link.labelKey)}
                </Link>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View role="navigation" style={styles.bar}>
        {TABS.map((tab) => {
          const active = !open && tab.match(pathname);
          const color = active ? palette.ocean700 : palette.ink700;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              style={styles.tab}
            >
              <TabGlyph icon={tab.key} color={color} />
              <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
                {t(tab.labelKey)}
              </Text>
              <ActiveDot on={active} />
            </Link>
          );
        })}
        <PressableRing
          onPress={() => setOpen(!open)}
          role="button"
          aria-expanded={open}
          accessibilityLabel={t('nav.more.title')}
          style={styles.tab}
        >
          <TabGlyph icon="mehr" color={moreActive ? palette.ocean700 : palette.ink700} />
          <Text numberOfLines={1} style={[styles.label, moreActive && styles.labelActive]}>
            {t('nav.mehr')}
          </Text>
          <ActiveDot on={moreActive} />
        </PressableRing>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Die Huelle selbst nimmt keinen Platz ein; Leiste, Schleier und Blatt
  // liegen fix am Bildschirm (wie die bisherige Leiste in NavBar.tsx).
  wrap: {
    position: 'relative',
    zIndex: 10,
  },
  bar: {
    position: 'fixed' as 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: MOBILE_TAB_BAR_SAFE_HEIGHT,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)' as unknown as number,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    zIndex: 12,
  },
  // display/flexDirection ausdruecklich: Link rendert im Web ein <Text> mit
  // display: inline (siehe NavBar.tsx, tabItem).
  tab: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.ink700,
  },
  labelActive: {
    color: colors.ocean700,
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
  },
  dotOn: {
    backgroundColor: colors.ocean700,
  },
  scrim: {
    position: 'fixed' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    zIndex: 10,
  },
  sheet: {
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: MOBILE_TAB_BAR_SAFE_HEIGHT as unknown as number,
    zIndex: 11,
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: 18,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderTopColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    backgroundColor: colors.lineStrong,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    minHeight: 86,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.oceanTint,
  },
  tileText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink900,
  },
  settingsRow: {
    marginTop: 10,
    minHeight: 52,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.oceanTint,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink900,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    marginTop: 14,
  },
  legalLink: {
    minHeight: 32,
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    color: colors.ink700,
    textDecorationLine: 'underline',
  },
});
