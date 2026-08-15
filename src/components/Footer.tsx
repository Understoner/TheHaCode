import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';

export function Footer() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Link href="/impressum" style={styles.link}>
        {t('footer.impressum')}
      </Link>
      <Text style={styles.separator}>·</Text>
      <Link href="/datenschutz" style={styles.link}>
        {t('footer.datenschutz')}
      </Link>
    </View>
  );
}

// Der Fussbereich traegt zwei Pflichtlinks und sonst nichts. Er darf deshalb
// so niedrig sein, wie es die Bedienbarkeit gerade noch zulaesst - jeder Pixel
// hier fehlt dem Inhalt darueber, und auf dem Handy sitzt unter dem Footer
// ohnehin schon die Tab-Leiste.
//
// Die senkrechte Luft steht bewusst an den Links und nicht am Rahmen: so
// bleibt die Trefferflaeche zum Antippen erhalten, waehrend der Streifen
// selbst von rund 66 auf rund 40 Pixel schrumpft.
const LINK_PADDING = 6;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
