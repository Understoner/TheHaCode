import { Link } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/design/tokens';

// Die vier Pflichtseiten. Als Liste statt als vier abgetippte Bloecke: der
// Fussbereich ist der einzige Ort, an dem sie alle erreichbar sind, und eine
// vergessene Seite faellt in einer Liste eher auf als in Auszeichnung.
const LEGAL_LINKS = [
  { href: '/impressum', labelKey: 'footer.impressum' },
  { href: '/datenschutz', labelKey: 'footer.datenschutz' },
  { href: '/agb', labelKey: 'footer.agb' },
  { href: '/haftungsausschluss', labelKey: 'footer.haftungsausschluss' },
] as const;

export function Footer() {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.streifen}
      contentContainerStyle={styles.container}
    >
      {LEGAL_LINKS.map((link, index) => (
        <Fragment key={link.href}>
          {index > 0 ? <Text style={styles.separator}>·</Text> : null}
          {/* numberOfLines: ohne das bricht ein einzelner Verweis innerhalb
              seiner selbst um, sobald der Streifen enger wird als die Reihe -
              genau das, was hier nicht passieren soll. */}
          <Link href={link.href} style={styles.link} numberOfLines={1}>
            {t(link.labelKey)}
          </Link>
        </Fragment>
      ))}
    </ScrollView>
  );
}

// Der Fussbereich traegt die Pflichtlinks und sonst nichts. Er darf deshalb
// so niedrig sein, wie es die Bedienbarkeit gerade noch zulaesst - jeder Pixel
// hier fehlt dem Inhalt darueber, und auf dem Handy sitzt unter dem Footer
// ohnehin schon die Tab-Leiste.
//
// Die senkrechte Luft steht bewusst an den Links und nicht am Rahmen: so
// bleibt die Trefferflaeche zum Antippen erhalten, waehrend der Streifen
// selbst schmal bleibt.
//
// EINE ZEILE, UND ZWAR IMMER (06.09.2026)
// ---------------------------------------
// Vorher durfte der Streifen umbrechen, und auf dem Handy tat er das auch:
// aus einer Zeile wurden zwei, und die zweite kostete Platz, der dem Inhalt
// darueber fehlte - direkt ueber der Tab-Leiste, wo es ohnehin am engsten ist.
//
// Zwei Massnahmen, und beide werden gebraucht:
//
//   1. KUERZERE BESCHRIFTUNGEN. "Datenschutzerklaerung" und
//      "Haftungsausschluss" sind zusammen achtunddreissig Zeichen; als
//      "Datenschutz" und "Haftung" sind es achtzehn. Die Seiten selbst heissen
//      unveraendert weiter wie zuvor - gekuerzt ist nur der Verweis.
//   2. WAAGRECHT SCHIEBBAR. Kuerzere Woerter allein reichen nicht: wer die
//      Systemschrift vergroessert, sprengt jede noch so knappe Zeile. Ein
//      Umbruch wuerde dann zurueckkehren, ohne dass es jemand merkt. Als
//      Schiebestreifen bleibt es unter allen Umstaenden eine Zeile.
//
// Dass Impressum dabei ganz links steht, ist kein Zufall: es ist der einzige
// Verweis, der rechtlich "leicht erkennbar" sein muss, und links ist die
// Stelle, die immer sichtbar bleibt. Passt alles in die Breite, steht die
// Reihe mittig - dafuer sorgt flexGrow zusammen mit justifyContent.
const LINK_PADDING = 6;

const styles = StyleSheet.create({
  // Die Linie und der Aussenabstand gehoeren an den Streifen, nicht an den
  // Inhalt: sonst waere die Trennlinie nur so breit wie die Links und wuerde
  // beim Schieben mitwandern.
  streifen: {
    flexGrow: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    // Mittig, solange alles hineinpasst; sonst beginnt die Reihe links, und
    // Impressum bleibt der erste sichtbare Verweis.
    flexGrow: 1,
    justifyContent: 'center',
    columnGap: spacing.sm,
    paddingVertical: LINK_PADDING,
    paddingHorizontal: spacing.md,
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink700,
    paddingVertical: LINK_PADDING,
  },
  separator: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink700,
  },
});
