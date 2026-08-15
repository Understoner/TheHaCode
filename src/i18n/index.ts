import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/de/common.json';
import errors from './locales/de/errors.json';
import legal from './locales/de/legal.json';

// Sprache V1: nur de (CLAUDE.md). Struktur bleibt i18n-fähig für weitere Sprachen.
//
// i18next exportiert `use` und `init` zusaetzlich als benannte Exporte. Die
// sind allerdings unverbunden aus der Instanz herausgeloest
// (`const use = instance.use`) und verlieren beim direkten Aufruf ihr `this`.
// Der Aufruf ueber die Instanz ist also der richtige, die Regel warnt hier ins
// Leere.
// eslint-disable-next-line import/no-named-as-default-member
i18next.use(initReactI18next).init({
  lng: 'de',
  fallbackLng: 'de',
  resources: {
    de: { common, errors, legal },
  },
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18next;
