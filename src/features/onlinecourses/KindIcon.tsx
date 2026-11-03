import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors, radius } from '@/design/tokens';
import type { BlockKind } from './courseLogic';

// Ein Zeichen je Blockart (Onlinekurse, V1.2) - gezeichnet, keine Emojis.
// Farbe je Art aus den Tokens, damit Video, Aufnahme, Text, PDF und Quiz in
// der Zeitleiste auf einen Blick auseinanderzuhalten sind.

const TONE: Record<BlockKind, string> = {
  video: colors.ocean700,
  audio: colors.sage700,
  text: colors.ink700,
  pdf: colors.focusRing,
  quiz: colors.ocean800,
};

export function KindIcon({ kind, size = 36 }: { kind: BlockKind; size?: number }) {
  const stroke = TONE[kind];
  const icon = size * 0.52;
  return (
    <View style={[styles.box, { width: size, height: size }]} aria-hidden>
      <Svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'video' ? (
          <>
            <Rect x={3} y={5} width={18} height={14} rx={3} />
            <Path d="M10 9.5v5l4.5-2.5z" fill={stroke} />
          </>
        ) : null}
        {kind === 'audio' ? <Path d="M4 12h1.5M8 8v8M11.5 5v14M15 9v6M18.5 11v2" /> : null}
        {kind === 'text' ? (
          <>
            <Rect x={3} y={4} width={18} height={16} rx={3} />
            <Path d="M7 9h6M7 13h10M7 16.5h7" />
          </>
        ) : null}
        {kind === 'pdf' ? (
          <>
            <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <Path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5" />
          </>
        ) : null}
        {kind === 'quiz' ? (
          <>
            <Circle cx={12} cy={12} r={9} />
            <Path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.sm,
    backgroundColor: colors.oceanTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
