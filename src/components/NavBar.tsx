import { Link, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { MOBILE_TAB_BAR_SAFE_HEIGHT, navItems, type NavIcon } from '@/design/navigation';
import { responsive } from '@/design/responsive';

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
    case 'sessions':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.sessionsRing, { borderColor: color }]} />
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

// Beide Fassungen stehen immer im HTML, sichtbar ist je nach Fensterbreite
// genau eine - ausgeblendet wird per Media Query, nicht per JavaScript
// (Begruendung in src/design/responsive.ts). display: none nimmt die
// ausgeblendete Fassung auch aus dem Accessibility-Baum, Screenreader sehen
// die Navigation also nicht doppelt.
export function NavBar() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <>
      {/* Ohne Wortzeichen traegt die Kopfzeile nur noch die Pillen - auf dem
          Handy waere sie damit ein leerer Streifen mit Trennlinie. Deshalb
          faellt jetzt die ganze Leiste weg statt nur ihr Inhalt: Desktop
          navigiert oben, das Handy unten. */}
      <View {...responsive('nav-desktop')} style={styles.topBar}>
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
              <Link key={item.key} href={item.href} aria-current={active ? 'page' : undefined}>
                <View style={[styles.pill, active && styles.pillActive]}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{t(item.labelKey)}</Text>
                </View>
              </Link>
            );
          })}
        </View>
      </View>

      <View {...responsive('nav-mobile')} role="navigation" style={styles.mobileTabBar}>
        {navItems.map((item) => {
          const active = item.kind === 'link' && item.href === pathname;
          const labelColor = active ? colors.ocean700 : colors.ink700;
          // Noch nicht gebaute Eintraege sind auf dem Handy sonst von echten
          // nicht zu unterscheiden - man tippt, und nichts passiert. Nur das
          // Symbol wird zurueckgenommen: ink500 ist laut Token-Kommentar
          // ausdruecklich fuer Icon-Striche gedacht, die Beschriftung bleibt
          // in ink700 und damit ueber 4,5:1 (CLAUDE.md).
          const glyphColor = item.kind === 'comingSoon' ? colors.ink500 : labelColor;
          const content = (
            <>
              <NavGlyph icon={item.icon} color={glyphColor} />
              <Text
                style={[styles.tabLabel, { color: labelColor }, active && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {t(item.labelKey)}
              </Text>
            </>
          );
          if (item.kind === 'comingSoon') {
            return (
              <View
                key={item.key}
                style={styles.tabItem}
                accessibilityLabel={`${t(item.labelKey)} — ${t('nav.comingSoon')}`}
              >
                {content}
              </View>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              style={styles.tabItem}
              aria-current={active ? 'page' : undefined}
            >
              {content}
            </Link>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
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
  // Kein opacity: 0.5 - das druecke den Kontrast von ink700 auf etwa 2:1 und
  // damit unter die 4,5:1-Regel (CLAUDE.md). Der Zusatz "· bald verfuegbar"
  // traegt die Bedeutung ohnehin allein.
  comingSoon: {
    fontSize: 13,
    color: colors.ink700,
  },

  // Mobile Tab-Bar - fixed unten, react-native-web unterstuetzt das, RNs
  // Style-Typen (nur nativ gedacht) kennen 'fixed' nicht.
  mobileTabBar: {
    position: 'fixed' as 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    // Inhaltshoehe bleibt MOBILE_TAB_BAR_HEIGHT, die Aussparung am unteren
    // Rand kommt darueber hinaus dazu (siehe design/navigation.ts).
    height: MOBILE_TAB_BAR_SAFE_HEIGHT,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)' as unknown as number,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    zIndex: 10,
  },
  // flex: 1 verteilt beliebig viele Eintraege gleichmaessig - aktuell 5
  // (News, Kurse, Sessions, Team, Konto), minWidth 0 verhindert, dass ein
  // langes Label den Nachbarn Platz wegnimmt.
  //
  // display/flexDirection stehen hier ausdruecklich, obwohl das fuer eine View
  // ohnehin der Standard ist: die Haelfte der Eintraege ist ein expo-router
  // <Link>, und der rendert im Web ein <Text> - dessen Grundstil ist
  // display: inline. Als Flex-Kind wird daraus block, nicht flex; alignItems,
  // justifyContent und gap greifen dann nicht, und Symbol samt Beschriftung
  // rutschen linksbuendig nebeneinander, waehrend die reinen View-Eintraege
  // ("Uebungen", "Konto") sauber zentriert untereinander stehen. Genau das war
  // die unsymmetrische Leiste. Beide Zweige brauchen denselben Boxtyp.
  tabItem: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  // lineHeight muss ausdruecklich gesetzt sein: numberOfLines={1} bringt in
  // react-native-web ein overflow: hidden mit, und mit dem Standard
  // line-height: normal ist die Zeilenbox bei 10px nur 11px hoch - zu niedrig
  // fuer Umlautpunkte, die damit abgeschnitten werden. Aufgefallen ist es an
  // "Übungen" (heute "Sessions"); die Beschriftungen sind deutsch, der
  // naechste Umlaut kommt bestimmt.
  tabLabel: {
    fontSize: 10,
    lineHeight: 14,
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
  sessionsRing: {
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
