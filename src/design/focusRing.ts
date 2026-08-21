import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/design/tokens';

// Ein sichtbarer Tastaturfokus auf allem, was sich druecken laesst.
//
// WARUM DAS EINE EIGENE DATEI IST
// -------------------------------
// react-native-web setzt auf Pressable von sich aus KEINEN Fokusring - anders
// als ein <button> im Browser. Wer mit der Tastatur navigiert, sieht also
// nicht, wo er steht. Button.tsx hatte deshalb schon immer einen eigenen Ring;
// die uebrigen dreizehn Pressables im Projekt hatten keinen (Backlog T03).
//
// Diese Datei ist die Farbe und die Zustandslogik; benutzt wird sie ueber
// components/PressableRing.tsx, das beides je Element kapselt. Direkt gebraucht
// wird der Hook nur dort, wo kein Pressable im Spiel ist - etwa in Button.tsx,
// das seinen Ring seit jeher selbst zeichnet.
//
// outline statt border: ein Rahmen wuerde die Flaeche beim Fokussieren um zwei
// Pixel wachsen lassen und das Layout springen. outline liegt ausserhalb und
// verschiebt nichts. react-native-web reicht die vier Eigenschaften
// unveraendert an CSS durch.
const RING: ViewStyle = {
  outlineColor: colors.ocean700,
  outlineOffset: 2,
  outlineStyle: 'solid',
  outlineWidth: 2,
} as ViewStyle;

export type FocusRing = {
  props: { onFocus: () => void; onBlur: () => void };
  style: StyleProp<ViewStyle>;
  focused: boolean;
};

export function useFocusRing(): FocusRing {
  const [focused, setFocused] = useState(false);

  return {
    props: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    style: focused ? RING : undefined,
    focused,
  };
}
