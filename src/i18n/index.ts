import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/de/common.json';
import errors from './locales/de/errors.json';

// Sprache V1: nur de (CLAUDE.md). Struktur bleibt i18n-fähig für weitere Sprachen.
i18next.use(initReactI18next).init({
  lng: 'de',
  fallbackLng: 'de',
  resources: {
    de: { common, errors },
  },
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18next;
