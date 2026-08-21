import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useFocusRing } from '@/design/focusRing';

// Ein Pressable, das zeigt, wenn es den Tastaturfokus hat.
//
// WARUM ES DAS BRAUCHT
// --------------------
// react-native-web setzt auf Pressable keinen Fokusring - anders als der
// Browser auf einem <button>. Wer mit der Tastatur navigiert, sieht also nicht,
// wo er gerade steht. Das betraf im Projekt dreizehn Dateien (Backlog T03).
//
// WARUM EIN WRAPPER UND NICHT NUR DER HOOK
// ----------------------------------------
// Wegen der Listen. Ein useFocusRing() je Komponente haette bei den Filterchips
// in NewsList und SessionsList alle Chips gleichzeitig leuchten lassen - der
// Zustand gehoert je Element, nicht je Bildschirm. Als Wrapper bekommt jedes
// Element seinen eigenen, ohne dass die aufrufende Stelle etwas davon weiss.
//
// style darf wie bei Pressable eine Funktion sein (fuer den pressed-Zustand);
// beide Faelle werden unten aufgeloest.
export function PressableRing({ style, onFocus, onBlur, ...rest }: PressableProps) {
  const focus = useFocusRing();

  return (
    <Pressable
      {...rest}
      onFocus={(event) => {
        focus.props.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        focus.props.onBlur();
        onBlur?.(event);
      }}
      style={(state) => [
        (typeof style === 'function' ? style(state) : style) as StyleProp<ViewStyle>,
        focus.style,
      ]}
    />
  );
}
