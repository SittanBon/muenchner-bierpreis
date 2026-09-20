import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminFetchBeerHistory } from '../hooks/useApi';
import { formatPrice, formatVolume } from '../utils/priceUtils';

// Full price history of one beer (admin only). Shows real observations and
// price changes, plus pending/rejected reports — and labels seeded estimates
// (formula-generated placeholders from the old seed script) so nobody mistakes
// them for a price anyone actually saw. "Verify" never appears here: confirming
// an unchanged price is not a price event.
//
// Remounted (via `key`) by its parent after a save/verify, which re-fetches.
export default function PriceHistoryTable({ token, venueId, beerId }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminFetchBeerHistory(token, venueId, beerId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [token, venueId, beerId]);

  if (failed) return <div className="ph-note ph-error">{t('admin.history.loadError')}</div>;
  if (!data) return <div className="ph-note">{t('loading')}</div>;

  const lang = i18n.language;
  const dateText = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang);
  const sourceText = (code) => (code ? t(`admin.price.sources.${code}`, code) : '—');

  return (
    <div className="ph-wrap">
      {data.entries.length === 0 ? (
        <div className="ph-note">{t('admin.history.empty')}</div>
      ) : (
        <div className="ph-scroll">
          <table className="ph-table">
            <thead>
              <tr>
                <th>{t('admin.history.date')}</th>
                <th>{t('admin.history.price')}</th>
                <th>{t('admin.history.size')}</th>
                <th>{t('admin.history.normalized')}</th>
                <th>{t('admin.history.source')}</th>
                <th>{t('admin.history.by')}</th>
                <th>{t('admin.history.status')}</th>
                <th>{t('admin.history.verified')}</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className={`${e.kind === 'seeded_estimate' ? 'ph-seeded' : ''} ${e.is_current ? 'ph-current' : ''}`}>
                  <td>
                    {dateText(e.date)}
                    {!e.date_is_observed && <span className="ph-flag" title={t('admin.history.recordedDate')}>*</span>}
                    {e.is_current && <span className="ph-badge ph-badge-current">{t('admin.history.current')}</span>}
                  </td>
                  <td className="ph-price">{formatPrice(e.price, lang)}</td>
                  <td>{formatVolume(e.serving_volume_ml, lang) || '—'}</td>
                  <td className="ph-muted">{e.normalized_500ml_price != null && e.serving_volume_ml !== 500 ? formatPrice(e.normalized_500ml_price, lang) : '—'}</td>
                  <td>
                    {e.kind === 'seeded_estimate'
                      ? <span className="ph-badge ph-badge-seeded" title={t('admin.history.seededHint')}>{t('admin.history.seeded')}</span>
                      : sourceText(e.source_type)}
                  </td>
                  <td>{e.submitted_by || '—'}</td>
                  <td>
                    <span className={`ph-status ph-status-${e.status}`}>{t(`admin.${e.status}`, e.status)}</span>
                    {e.not_applied && <span className="ph-notapplied" title={t('admin.history.notAppliedHint')}>{t('admin.history.notApplied')}</span>}
                  </td>
                  <td>{e.verified_at ? dateText(e.verified_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="ph-note">{t('admin.history.legend')}</div>
    </div>
  );
}
