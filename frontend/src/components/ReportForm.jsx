import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitReport } from '../hooks/useApi';
import { BRANDS, OTHER_BRAND } from '../constants/brands';
import { parsePrice } from '../utils/price';

const TOPICS = [
  { key: 'price_change', icon: '💶' },
  { key: 'new_beer', icon: '🍺' },
  { key: 'closed', icon: '🔒' },
  { key: 'other_info', icon: 'ℹ️' },
];

// The single "📢 Report" button on a venue detail page opens this: pick a topic
// first, then a topic-specific form. Replaces what used to be several separate
// buttons (one per beer's "Report price", "+ report a new brand", "report
// incorrect info") with one funnel, all landing in the same admin queue
// labelled by `report_type`.
export default function ReportForm({ venueId, venueName, venueBrands, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState(null);
  const [form, setForm] = useState({
    beer_brand: '', other_brand: '', size: '0.5L', price: '',
    visit_date: new Date().toISOString().split('T')[0],
    submitter_name: '', anonymous: false, note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (extra) => {
    setLoading(true);
    setError('');
    try {
      await submitReport({
        report_type: topic,
        venue_id: venueId,
        venue_name: venueName,
        submitter_name: form.anonymous ? 'Anonym' : form.submitter_name,
        note: form.note,
        ...extra,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || t('submission.error'));
    }
    setLoading(false);
  };

  const submitPriceReport = () => {
    const resolvedBrand = form.beer_brand === OTHER_BRAND ? form.other_brand.trim() : form.beer_brand;
    const price = parsePrice(form.price);
    if (!resolvedBrand || price == null) {
      setError(t('report.errBrandPrice'));
      return;
    }
    submit({ beer_brand: resolvedBrand, size: form.size, price, visit_date: form.visit_date });
  };

  const submitClosed = () => submit({});

  const submitOtherInfo = () => {
    if (!form.note.trim()) { setError(t('report.errNote')); return; }
    submit({});
  };

  const nameRow = (
    <div className="sf-field">
      <label>{t('submission.name')}</label>
      <div className="sf-name-row">
        <input
          type="text" placeholder={t('submission.namePlaceholder')}
          value={form.submitter_name} onChange={(e) => set('submitter_name', e.target.value)}
          disabled={form.anonymous} style={{ flex: 1 }}
        />
        <label className="anon-toggle">
          <input type="checkbox" checked={form.anonymous} onChange={(e) => set('anonymous', e.target.checked)} />
          <span>{t('submission.anonymous')}</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="submission-form report-form">
      <div className="sf-title">📢 {t('report.title')}</div>
      {venueName && <div className="sf-venue">{venueName}</div>}

      {!topic && (
        <div className="report-topics">
          {TOPICS.map((tp) => (
            <button key={tp.key} type="button" className="report-topic-btn" onClick={() => setTopic(tp.key)}>
              <span className="report-topic-icon">{tp.icon}</span>
              {t(`report.topics.${tp.key}`)}
            </button>
          ))}
        </div>
      )}

      {(topic === 'price_change' || topic === 'new_beer') && (
        <>
          <div className="sf-field">
            <label>{t('submission.brand')}</label>
            <select value={form.beer_brand} onChange={(e) => set('beer_brand', e.target.value)}>
              <option value="">-- {t('submission.brand')} --</option>
              {topic === 'price_change' ? (
                venueBrands.map((b) => <option key={b} value={b}>{b}</option>)
              ) : (
                BRANDS.map((b) => <option key={b} value={b}>{b}</option>)
              )}
            </select>
            {topic === 'new_beer' && form.beer_brand === OTHER_BRAND && (
              <input
                type="text" className="sf-other-brand" placeholder={t('submission.otherBrandPlaceholder')}
                value={form.other_brand} onChange={(e) => set('other_brand', e.target.value)}
              />
            )}
          </div>
          <div className="sf-row">
            <div className="sf-field half">
              <label>{t('submission.size')}</label>
              <select value={form.size} onChange={(e) => set('size', e.target.value)}>
                <option value="0.5L">0,5L (Halbe)</option>
                <option value="1L">1L (Maß)</option>
              </select>
            </div>
            <div className="sf-field half">
              <label>{t('submission.price')}</label>
              <input
                type="text" placeholder={t('submission.pricePlaceholder')} inputMode="decimal"
                value={form.price} onChange={(e) => set('price', e.target.value)}
              />
            </div>
          </div>
          <div className="sf-field">
            <label>{t('submission.date')}</label>
            <input type="date" value={form.visit_date} onChange={(e) => set('visit_date', e.target.value)} max={new Date().toISOString().split('T')[0]} />
          </div>
          {nameRow}
          {error && <div className="sf-error">{error}</div>}
          <div className="sf-actions">
            <button className="sf-cancel" onClick={() => setTopic(null)}>← {t('report.back')}</button>
            <button className="sf-submit" onClick={submitPriceReport} disabled={loading}>
              {loading ? '...' : t('submission.submit')}
            </button>
          </div>
        </>
      )}

      {topic === 'closed' && (
        <>
          <p className="report-closed-text">{t('report.closedConfirm')}</p>
          <div className="sf-field">
            <label>{t('report.noteOptional')}</label>
            <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
          {nameRow}
          {error && <div className="sf-error">{error}</div>}
          <div className="sf-actions">
            <button className="sf-cancel" onClick={() => setTopic(null)}>← {t('report.back')}</button>
            <button className="sf-submit" onClick={submitClosed} disabled={loading}>
              {loading ? '...' : t('report.confirmClosed')}
            </button>
          </div>
        </>
      )}

      {topic === 'other_info' && (
        <>
          <div className="sf-field">
            <label>{t('report.noteLabel')}</label>
            <textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('report.notePlaceholder')} />
          </div>
          {nameRow}
          {error && <div className="sf-error">{error}</div>}
          <div className="sf-actions">
            <button className="sf-cancel" onClick={() => setTopic(null)}>← {t('report.back')}</button>
            <button className="sf-submit" onClick={submitOtherInfo} disabled={loading}>
              {loading ? '...' : t('submission.submit')}
            </button>
          </div>
        </>
      )}

      {!topic && (
        <div className="sf-actions">
          <button className="sf-cancel" onClick={onCancel}>{t('admin.venues.cancel')}</button>
        </div>
      )}
    </div>
  );
}
