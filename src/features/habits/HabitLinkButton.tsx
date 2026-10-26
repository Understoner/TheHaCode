import { Link } from 'expo-router';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors } from '@/design/tokens';
import { openExternalUrl } from '@/lib/externalLink';

import { habitLinkTarget } from './habitLink';

/**
 * Der Link eines eigenen Habits (0030). Pfade dieser App oeffnen sich in der
 * App, alles andere geprueft nach draussen. Ein unbrauchbarer Link zeigt
 * nichts an - besser kein Knopf als einer, der ins Leere fuehrt.
 */
export function HabitLinkButton({
  url,
  sessionLabel,
  linkLabel,
  style,
}: {
  url: string | null | undefined;
  sessionLabel: string;
  linkLabel: string;
  style?: StyleProp<TextStyle>;
}) {
  const target = habitLinkTarget(url);
  if (!target) return null;

  if (target.kind === 'app') {
    return (
      // Der Pfad ist zur Laufzeit ein beliebiger String; die getypten Routen
      // kennen ihn nicht.
      <Link href={target.href as never} style={[styles.link, style]}>
        {target.isSession ? sessionLabel : linkLabel}
      </Link>
    );
  }

  return (
    <PressableRing role="link" onPress={() => openExternalUrl(target.href)}>
      <Text style={[styles.link, style]}>{`${linkLabel} ↗`}</Text>
    </PressableRing>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
