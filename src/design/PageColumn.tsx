import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { responsive } from '@/design/responsive';
import { spacing } from '@/design/tokens';

/**
 * Die Seitenspalte im Mondlicht-Design (02.11.2026, nur Testsystem): mobil
 * hoechstens 720 px, am Desktop 1120 px (responsive.ts, "m-page") - immer in
 * der Mitte, damit Kurse, Sessions und News gleich ausgerichtet sind.
 */
export function PageColumn({ children, gap = spacing.md }: { children: ReactNode; gap?: number }) {
  return (
    <View {...responsive('m-page')} style={[styles.page, { gap }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
