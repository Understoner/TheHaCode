import Svg, { Path } from 'react-native-svg';

import { useThemePalette } from '@/design/theme';

/**
 * Der Mond: Zeichen der Startseite (01.11.2026, nur Testsystem). Er steht
 * links oben in der Kopfzeile und fuehrt immer zur Startseite zurueck.
 * In "Klar" Ocean, in "Mondlicht" Gold.
 *
 * Die Farbe kommt als Hex aus der Palette und nicht als CSS-Variable: als
 * SVG-Attribut loest nicht jeder Browser var() sicher auf.
 */
export function MoonMark({ size = 26 }: { size?: number }) {
  const palette = useThemePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <Path d="M19 4a10 10 0 1 0 5 15A8 8 0 0 1 19 4z" fill={palette.glow} />
    </Svg>
  );
}
