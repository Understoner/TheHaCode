import { StyleSheet, View, Image, type ImageStyle, type StyleProp } from 'react-native';

import { colors, radius } from '@/design/tokens';
import { supabase } from '@/lib/supabase';

type Props = {
  path: string | null;
  label: string;
  tone: 'ocean' | 'sage';
  style?: StyleProp<ImageStyle>;
};

// Zeigt das echte Cover-Bild, wenn eines gepflegt ist - sonst eine ruhige
// getoente Flaeche mit einem abstrakten Wasserzeichen (Ring + Kreuz, echoing
// den Atem-Ring) statt eines leeren grauen Blocks. Kein Stockfoto, keine
// erfundene Illustration - nur Farbe und Form aus den Tokens.
export function CoverImage({ path, label, tone, style }: Props) {
  const url = path ? supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl : null;

  if (url) {
    return <Image source={{ uri: url }} style={style} accessibilityLabel={label} />;
  }

  const tint = tone === 'ocean' ? colors.oceanImageBg : colors.sageTint;
  const mark = tone === 'ocean' ? colors.ocean500 : colors.sage500;

  return (
    <View style={[style, { backgroundColor: tint }, styles.watermarkWrap]} accessibilityLabel={label}>
      <View style={[styles.watermarkRing, { borderColor: mark }]} />
      <View style={[styles.watermarkLineV, { backgroundColor: mark }]} />
      <View style={[styles.watermarkLineH, { backgroundColor: mark }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  watermarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkRing: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 1.5,
    opacity: 0.3,
  },
  watermarkLineV: {
    position: 'absolute',
    width: 1.5,
    height: 56,
    opacity: 0.25,
  },
  watermarkLineH: {
    position: 'absolute',
    width: 56,
    height: 1.5,
    opacity: 0.25,
  },
});
