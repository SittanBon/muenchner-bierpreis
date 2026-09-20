import { useTranslation } from 'react-i18next';
import { formatPrice, formatVolume } from '../utils/priceUtils';
import FreshnessLight from './FreshnessLight';

// What a reviewer needs to judge a price submission without leaving the queue:
// the submitted price at its serving size and per 0.5 L, the venue's CURRENT
// price for that beer (with how fresh it is), the difference and a >25%
// outlier warning, plus when it was seen, where it came from and who sent it.
// (Data comes pre-computed from GET /api/admin/submissions.)
export default function SubmissionPriceInfo({ sub, pending }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const size = formatVolume(sub.serving_volume_ml, lang);
  const showNormalized = sub.normalized_500ml_price != null && sub.serving_volume_ml !== 500;
  const cur = sub.current;
  const curSize = cur ? formatVolume(cur.serving_volume_ml, lang) : null;
  const diff = sub.difference_pct;
  const sign = diff > 0 ? '+' : '';

  return (
    <div className="spi">
      <div className="spi-row">
        <span className="spi-label">{t('admin.sub.submitted')}</span>
        <span>
          <strong>{formatPrice(sub.price, lang)}</strong>
          {' · '}{size || sub.size || '?'}
          {showNormalized && <span className="spi-muted"> → {t('admin.sub.per05', { price: formatPrice(sub.normalized_500ml_price, lang) })}</span>}
        </span>
      </div>

      <div className="spi-row">
        <span className="spi-label">{t('admin.sub.current')}</span>
        {cur ? (
          <span>
            <strong>{formatPrice(cur.price, lang)}</strong>
            {curSize ? ` · ${curSize}` : ''}
            {cur.serving_volume_ml != null && cur.serving_volume_ml !== 500 && cur.normalized_500ml_price != null && (
              <span className="spi-muted"> → {t('admin.sub.per05', { price: formatPrice(cur.normalized_500ml_price, lang) })}</span>
            )}
            <span className="spi-fresh"><FreshnessLight beer={cur} /></span>
          </span>
        ) : <span className="spi-muted">{t('admin.sub.noCurrent')}</span>}
      </div>

      {diff != null && (
        <div className="spi-row">
          <span className="spi-label">{t('admin.sub.difference')}</span>
          <span>
            {sign}{diff.toLocaleString(lang, { maximumFractionDigits: 1 })} %
            {sub.outlier && <span className="outlier-badge spi-outlier">{t('admin.sub.outlier')}</span>}
          </span>
        </div>
      )}

      <div className="spi-row spi-meta">
        <span>📅 {t('admin.sub.observedOn')} <strong>{sub.visit_date || '—'}</strong></span>
        <span>{t('admin.sub.source')}: <strong>{t(`admin.price.sources.${sub.source_type}`, sub.source_type)}</strong></span>
        <span>👤 {t('admin.sub.by')} <strong>{sub.submitter_name || '—'}</strong></span>
      </div>

      {sub.size_valid === false && <div className="spi-warn">{t('admin.sub.invalidSize')}</div>}
      {pending && sub.size_valid !== false && <div className="spi-hint">{t('admin.sub.approveHint')}</div>}
    </div>
  );
}
