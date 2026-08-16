import { Link } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.container}>
      {LEGAL_LINKS.map((link, index) => (
        <Fragment key={link.href}>
          {index > 0 ? <Text style={styles.separator}>·</Text> : null}
          <Link href={link.href} style={styles.link}>
            {t(link.labelKey)}
          </Link>
        </Fragment>
      ))}
    </View>
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
// Seit vier statt zwei Links darin stehen, darf die Zeile umbrechen. Auf
// schmalen Geraeten wird daraus ein zweizeiliger Block - das ist der einzige
// Weg, der weder die Schrift verkleinert noch die Trefferflaechen beschneidet.
const LINK_PADDING = 6;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
    paddingVertical: LINK_PADDING,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
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
