import { useTranslation } from 'react-i18next';

// Present everywhere (main map view + both legal pages) so Impressum/
// Datenschutz/Kontakt are always one click away — the actual legal
// requirement behind this whole feature. Deliberately understated: real,
// but not something meant to compete for attention with the app itself.
export default function Footer({ navigate }) {
  const { t } = useTranslation();
  return (
    <footer className="app-footer">
      <span>{t('footer.copyright')}</span>
      <span className="app-footer-sep">·</span>
      <a href="/impressum" onClick={(e) => navigate(e, '/impressum')}>{t('footer.impressum')}</a>
      <span className="app-footer-sep">·</span>
      <a href="/datenschutz" onClick={(e) => navigate(e, '/datenschutz')}>{t('footer.datenschutz')}</a>
      <span className="app-footer-sep">·</span>
      <a href="mailto:charoensuwan.s@gmail.com">{t('footer.kontakt')}</a>
    </footer>
  );
}
