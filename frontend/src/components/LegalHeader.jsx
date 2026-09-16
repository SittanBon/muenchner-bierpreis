import { useTranslation } from 'react-i18next';

// Shared top bar for the standalone legal pages (Impressum/Datenschutz) — a
// simpler cousin of the main navbar, since these pages have no map/sidebar,
// just a way back home and the same language toggle everywhere else uses.
export default function LegalHeader({ onBack }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="legal-header">
      <a href="/" className="legal-back-btn" onClick={onBack}>← {t('report.back')}</a>
      <div className="legal-header-brand">
        <span className="nav-logo">🍺</span>
        <span>{t('nav.title')}</span>
      </div>
      <button className="lang-btn" onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}>
        {t('nav.language')}
      </button>
    </div>
  );
}
