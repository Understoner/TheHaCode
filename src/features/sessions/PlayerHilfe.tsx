import { useTranslation } from 'react-i18next';

import { InfoButton } from '@/components/InfoButton';

/** Wie viele Abschnitte hilfe.player.* in der Uebersetzung hat. */
export const PLAYER_ABSCHNITTE = 6;

/**
 * Die Bedienungshilfe im Player. Pflichtinhalt laut Auftrag vom 14.09.2026:
 * dass Ton und Stimme bei lautlos gestelltem Handy nicht zu hoeren sind
 * (Abschnitt 4) - die Wachhaltung, die das umginge, ist bewusst abgeschaltet
 * (src/lib/contentSecurityPolicy.ts).
 */
export function PlayerHilfe() {
  const { t } = useTranslation();

  const abschnitte = Array.from({ length: PLAYER_ABSCHNITTE }, (_, i) => ({
    titel: t(`hilfe.player.${i + 1}.titel`),
    text: t(`hilfe.player.${i + 1}.text`),
  }));

  return (
    <InfoButton
      label={t('hilfe.player.oeffnen')}
      titel={t('hilfe.player.titel')}
      abschnitte={abschnitte}
    />
  );
}
