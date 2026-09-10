import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { de, en } from './translations';

i18n.use(initReactI18next).init({
  resources: { de, en },
  lng: navigator.language.startsWith('de') ? 'de' : 'en',
  fallbackLng: 'de',
  interpolation: { escapeValue: false }
});

export default i18n;
