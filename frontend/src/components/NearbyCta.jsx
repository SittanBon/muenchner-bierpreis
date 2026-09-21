import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// "🍺 GÜNSTIGES BIER IN DER NÄHE →" — asks the browser for the position (only when
// tapped, never on page load) and hands the result to the app, which filters the
// venues to the ones within 1 km, cheapest first. Nothing here is fake data:
// on refusal or failure it says so plainly and offers "try again" / "show Munich".
export default function NearbyCta({ status, onRequest, onShowMunich }) {
  const { t } = useTranslation();
  const loading = status === 'loading';

  return (
    <div className="nearby">
      <button type="button" className="nearby-cta" onClick={onRequest} disabled={loading} aria-busy={loading}>
        <span className="nearby-cta-label">
          <span aria-hidden="true">🍺</span>
          <span>{loading ? t('nearby.locating') : t('nearby.cta')}</span>
        </span>
        {loading
          ? <LoaderCircle className="nearby-spin" size={22} aria-hidden="true" />
          : <ArrowRight size={22} aria-hidden="true" />}
      </button>

      {status === 'error' && (
        <div className="nearby-error" role="alert">
          <p>{t('nearby.error')}</p>
          <div className="nearby-error-actions">
            <button type="button" className="btn-outline" onClick={onRequest}>{t('nearby.retry')}</button>
            <button type="button" className="btn-outline" onClick={onShowMunich}>{t('nearby.showMunich')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
