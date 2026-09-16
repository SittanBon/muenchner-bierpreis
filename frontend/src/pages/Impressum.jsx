import { useTranslation } from 'react-i18next';
import LegalHeader from '../components/LegalHeader';
import Footer from '../components/Footer';

export default function Impressum({ onBack, navigate }) {
  const { t } = useTranslation();
  return (
    <div className="legal-page">
      <LegalHeader onBack={onBack} />
      <div className="legal-content">
        <div className="legal-content-inner">
          <h1>{t('impressum.title')}</h1>
          <p className="legal-lede">{t('impressum.intro')}</p>

          <p className="legal-address">
            {t('impressum.name')}<br />
            {t('impressum.addressLine1')}<br />
            {t('impressum.addressLine2')}<br />
            {t('impressum.country')}
          </p>

          <h2>{t('impressum.contactTitle')}</h2>
          <p>{t('impressum.emailLabel')}: <a href="mailto:charoensuwan.s@gmail.com">charoensuwan.s@gmail.com</a></p>

          <h2>{t('impressum.responsibleTitle')}</h2>
          <p>
            {t('impressum.name')}<br />
            {t('impressum.addressLine1')}<br />
            {t('impressum.addressLine2')}
          </p>

          <h2>{t('impressum.priceNoticeTitle')}</h2>
          <p>{t('impressum.priceNoticeBody')}</p>
        </div>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
