import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminFetchDataQuality, adminDismissFlag, adminVerifyBeer } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { formatPrice, formatVolume } from '../utils/priceUtils';
import { FLAG_ORDER, flagSeverity } from '../utils/dataQualityFlags';
import FreshnessLight from './FreshnessLight';

const PAGE = 25; // venues shown per "show more"

// The admin "Data Quality" tab: an automatic list of suspicious/incomplete
// price records for HUMAN review. Nothing here deletes or auto-fixes anything —
// each flag offers Edit (open the venue editor), Verify (only where confirming
// the price actually resolves the flag) and Dismiss (hide this flag for 7 days).
export default function DataQualityPanel({ token, onEditVenue }) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const lang = i18n.language;
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState(null);      // a flag code, or null = all
  const [visible, setVisible] = useState(PAGE);
  const [busy, setBusy] = useState(null);           // the flag row currently acting

  const load = useCallback(() => adminFetchDataQuality(token).then((d) => { setData(d); setFailed(false); })
    .catch(() => setFailed(true)), [token]);
  useEffect(() => { load(); }, [load]);

  const rowKey = (venueId, f) => `${f.flag}|${venueId}|${f.beer_id || 0}`;

  const verify = async (group, f) => {
    setBusy(rowKey(group.venue_id, f));
    try {
      await adminVerifyBeer(token, group.venue_id, f.beer_id);
      showToast('success', t('admin.quality.verifiedToast', { venue: group.name }));
      await load();
    } catch (err) {
      showToast('error', err.message);
    }
    setBusy(null);
  };

  const dismiss = async (group, f) => {
    setBusy(rowKey(group.venue_id, f));
    try {
      await adminDismissFlag(token, { flag: f.flag, venue_id: group.venue_id, beer_id: f.beer_id || 0 });
      showToast('success', t('admin.quality.dismissedToast'));
      await load();
    } catch (err) {
      showToast('error', err.message);
    }
    setBusy(null);
  };

  if (failed && !data) return <div className="dq-panel"><div className="dq-error">{t('admin.quality.loadError')}</div></div>;
  if (!data) return <div className="dq-panel"><div className="loading">{t('loading')}</div></div>;

  const { summary } = data;
  const groups = filter
    ? data.venues.map((g) => ({ ...g, flags: g.flags.filter((f) => f.flag === filter) })).filter((g) => g.flags.length)
    : data.venues;
  const shown = groups.slice(0, visible);

  const describe = (f) => {
    if (f.flag === 'DUPLICATE_VENUE') return t('admin.quality.desc.DUPLICATE_VENUE', { names: (f.detail?.also || []).map((o) => o.name).join(', ') });
    if (f.flag === 'EXTREME_NORMALIZED_PRICE') return t('admin.quality.desc.EXTREME_NORMALIZED_PRICE', { price: formatPrice(f.beer?.normalized_500ml_price, lang) });
    return t(`admin.quality.desc.${f.flag}`, '');
  };

  return (
    <div className="dq-panel">
      <div className="dq-summary">
        <div className="dq-summary-main">
          {summary.venues_needing_attention > 0
            ? <span className="dq-summary-text">{t('admin.quality.summary', { count: summary.venues_needing_attention })}</span>
            : <span className="dq-summary-clean">{t('admin.quality.summaryClean')}</span>}
        </div>
        <div className="dq-summary-sub">
          {t('admin.quality.summarySub', { flags: summary.total_flags, dismissed: summary.dismissed_active })}
        </div>
        <div className="dq-review-only">{t('admin.quality.reviewOnly')}</div>
      </div>

      <div className="dq-chips" role="group" aria-label={t('admin.quality.title')}>
        <button type="button" className={`dq-chip ${filter === null ? 'active' : ''}`} aria-pressed={filter === null}
          onClick={() => { setFilter(null); setVisible(PAGE); }}>
          {t('admin.quality.allFlags')} <span className="dq-chip-n">{summary.total_flags}</span>
        </button>
        {FLAG_ORDER.map((code) => (
          <button
            key={code} type="button"
            className={`dq-chip dq-chip-${flagSeverity(code)} ${filter === code ? 'active' : ''}`}
            aria-pressed={filter === code} disabled={!summary.by_flag[code]}
            onClick={() => { setFilter(filter === code ? null : code); setVisible(PAGE); }}
          >
            {t(`admin.quality.flags.${code}`)} <span className="dq-chip-n">{summary.by_flag[code] || 0}</span>
          </button>
        ))}
      </div>

      <div className="dq-list">
        {shown.map((g) => (
          <div key={g.venue_id} className="dq-venue">
            <div className="dq-venue-head">
              <strong>{g.name}</strong>
              <span className="dq-hood">{lang === 'de' ? g.neighbourhood_name_de : g.neighbourhood_name_en}</span>
              <button type="button" className="dq-btn dq-btn-edit" onClick={() => onEditVenue(g)}>{t('admin.quality.edit')}</button>
            </div>
            {g.flags.map((f) => {
              const key = rowKey(g.venue_id, f);
              const working = busy === key;
              return (
                <div key={key} className="dq-flag-row">
                  <span className={`dq-badge dq-badge-${flagSeverity(f.flag)}`}>{t(`admin.quality.flags.${f.flag}`, f.flag)}</span>
                  <div className="dq-flag-info">
                    {f.brand && (
                      <div className="dq-beer">
                        <strong>{f.brand}</strong>
                        {f.beer && f.beer.price != null && <> · {formatPrice(f.beer.price, lang)}</>}
                        {f.beer && f.beer.serving_volume_ml != null && <> · {formatVolume(f.beer.serving_volume_ml, lang)}</>}
                        {f.beer && <span className="dq-fresh"><FreshnessLight beer={f.beer} /></span>}
                      </div>
                    )}
                    <div className="dq-desc">{describe(f)}</div>
                  </div>
                  <div className="dq-actions">
                    {f.verifiable && f.beer_id && (
                      <button type="button" className="dq-btn dq-btn-verify" disabled={working} title={t('admin.quality.verifyHint')} onClick={() => verify(g, f)}>
                        {t('admin.quality.verify')}
                      </button>
                    )}
                    <button type="button" className="dq-btn" disabled={working} title={t('admin.quality.dismissHint')} onClick={() => dismiss(g, f)}>
                      {t('admin.quality.dismiss')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {groups.length > visible && (
          <button type="button" className="dq-more" onClick={() => setVisible((v) => v + PAGE)}>
            {t('admin.quality.showMore', { count: groups.length - visible })}
          </button>
        )}
      </div>
    </div>
  );
}
