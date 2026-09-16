import { useTranslation } from 'react-i18next';
import LegalHeader from '../components/LegalHeader';
import Footer from '../components/Footer';

export default function Datenschutz({ onBack, navigate }) {
  const { t } = useTranslation();
  const notCollect = t('datenschutz.notCollect', { returnObjects: true });
  const collect2Items = t('datenschutz.collect2Items', { returnObjects: true });
  const thirdParty = t('datenschutz.thirdParty', { returnObjects: true });
  const rights = t('datenschutz.rights', { returnObjects: true });

  return (
    <div className="legal-page">
      <LegalHeader onBack={onBack} />
      <div className="legal-content">
        <div className="legal-content-inner">
          <h1>{t('datenschutz.title')}</h1>
          <p className="legal-lede">{t('datenschutz.intro')}</p>

          <h2>{t('datenschutz.controllerTitle')}</h2>
          <p>
            {t('impressum.name')}<br />
            {t('impressum.addressLine1')}<br />
            {t('impressum.addressLine2')}<br />
            {t('datenschutz.emailLabel')}: <a href="mailto:charoensuwan.s@gmail.com">charoensuwan.s@gmail.com</a>
          </p>

          <h2>{t('datenschutz.notCollectTitle')}</h2>
          <ul className="legal-checklist">
            {notCollect.map((item, i) => <li key={i}>✓ {item}</li>)}
          </ul>

          <h2>{t('datenschutz.collectTitle')}</h2>

          <h3>{t('datenschutz.collect1Title')}</h3>
          <p>{t('datenschutz.collect1Body')}</p>
          <p>
            {t('datenschutz.collect1LinkLabel')}{' '}
            <a href="https://railway.app/legal/privacy" target="_blank" rel="noopener noreferrer">
              https://railway.app/legal/privacy
            </a>
          </p>

          <h3>{t('datenschutz.collect2Title')}</h3>
          <p>{t('datenschutz.collect2Intro')}</p>
          <ul>
            {collect2Items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>

          <p className="legal-emphasis">{t('datenschutz.noShare')}</p>

          <h2>{t('datenschutz.thirdPartyTitle')}</h2>
          <ul>
            {thirdParty.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{t('datenschutz.noAds')}</p>

          <h2>{t('datenschutz.rightsTitle')}</h2>
          <p>{t('datenschutz.rightsIntro')}</p>
          <ul>
            {rights.map((item, i) => <li key={i}>{item}</li>)}
          </ul>

          <p>
            {t('datenschutz.requestsNote')} <a href="mailto:charoensuwan.s@gmail.com">charoensuwan.s@gmail.com</a><br />
            {t('datenschutz.responseTime')}
          </p>

          <p className="legal-updated">{t('datenschutz.lastUpdated')}</p>
        </div>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
