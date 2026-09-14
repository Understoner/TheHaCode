import { useTranslation } from 'react-i18next';

import { InfoButton } from '@/components/InfoButton';

/** Wie viele Abschnitte hilfe.sequenz.* in der Uebersetzung hat. */
export const KONFIGURATOR_ABSCHNITTE = 6;

/**
 * Die Bedienungshilfe beim Anlegen und Bearbeiten eigener Sequenzen. Die
 * Grenzen im Text (Dauer, Runden, Pause, Anzahl) stehen so auch in schema.ts
 * und errors.json - aendert sich dort eine, gehoert sie hier mitgezogen.
 */
export function KonfiguratorHilfe() {
  const { t } = useTranslation();

  const abschnitte = Array.from({ length: KONFIGURATOR_ABSCHNITTE }, (_, i) => ({
    titel: t(`hilfe.sequenz.${i + 1}.titel`),
    text: t(`hilfe.sequenz.${i + 1}.text`),
  }));

  return (
    <InfoButton
      label={t('hilfe.sequenz.oeffnen')}
      titel={t('hilfe.sequenz.titel')}
      abschnitte={abschnitte}
    />
  );
}
