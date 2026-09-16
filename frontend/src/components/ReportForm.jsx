import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitReport } from '../hooks/useApi';
import { parsePrice } from '../utils/price';
import { useToast } from '../hooks/useToast';
import BrandCombobox from './BrandCombobox';

// One success-toast message per report topic — keyed the same as `topic`.
const SUCCESS_TOAST_KEY = {
  price_change: 'toast.priceReportSuccess',
  new_beer: 'toast.priceReportSuccess',
  closed: 'toast.closedSuccess',
  other_info: 'toast.wrongInfoSuccess',
  suggest_description: 'toast.wrongInfoSuccess',
};

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
export default function ReportForm({ venueId, venueName, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const [topic, setTopic] = useState(null);
  // Only meaningful while topic === 'other_info' — null shows the sub-menu
  // ("something else is wrong" vs "suggest a description") before either form.
  const [otherSubtopic, setOtherSubtopic] = useState(null);
  const [form, setForm] = useState({
    beer_brand: '', size: '0.5L', price: '', serve_type: 'unknown',
    visit_date: new Date().toISOString().split('T')[0],
    submitter_name: '', anonymous: false, note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // reportTypeOverride covers 'suggest_description' — a sub-option nested
  // under the 'other_info' topic card, not its own top-level TOPICS entry, so
  // it can't just fall out of the `topic` state like every other report_type.
  const submit = async (extra, reportTypeOverride) => {
    const reportType = reportTypeOverride || topic;
    setLoading(true);
    setError('');
    try {
      await submitReport({
        report_type: reportType,
        venue_id: venueId,
        venue_name: venueName,
        submitter_name: form.anonymous ? 'Anonym' : form.submitter_name,
        note: form.note,
        ...extra,
      });
      showToast('success', t(SUCCESS_TOAST_KEY[reportType] || 'toast.priceReportSuccess'));
      onSuccess();
    } catch (err) {
      setError(err.message || t('submission.error'));
      showToast('error', t('toast.genericError'));
    }
    setLoading(false);
  };

  const submitPriceReport = () => {
    const resolvedBrand = form.beer_brand.trim();
    const price = parsePrice(form.price);
    if (!resolvedBrand || price == null) {
      setError(t('report.errBrandPrice'));
      return;
    }
    submit({ beer_brand: resolvedBrand, size: form.size, price, serve_type: form.serve_type, visit_date: form.visit_date });
  };

  const submitClosed = () => submit({});

  const submitOtherInfo = () => {
    if (!form.note.trim()) { setError(t('report.errNote')); return; }
    submit({});
  };

  const submitDescription = () => {
    if (!form.note.trim()) { setError(t('report.errNote')); return; }
    submit({}, 'suggest_description');
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
            <button
              key={tp.key} type="button" className="report-topic-btn"
              onClick={() => { setTopic(tp.key); setOtherSubtopic(null); setForm((f) => ({ ...f, note: '' })); }}
            >
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
            <BrandCombobox
              value={form.beer_brand}
              onChange={(v) => set('beer_brand', v)}
              placeholder={t('brandPicker.placeholder')}
              id={`report-brand-${topic}`}
            />
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
            <label>{t('serveType.question')}</label>
            <select value={form.serve_type} onChange={(e) => set('serve_type', e.target.value)}>
              <option value="tap">🍺 {t('serveType.tap')}</option>
              <option value="bottle">🍾 {t('serveType.bottle')}</option>
              <option value="can">🥫 {t('serveType.can')}</option>
              <option value="unknown">❓ {t('serveType.dontKnow')}</option>
            </select>
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

      {topic === 'other_info' && otherSubtopic === null && (
        <div className="report-topics">
          <button type="button" className="report-topic-btn" onClick={() => setOtherSubtopic('generic')}>
            <span className="report-topic-icon">ℹ️</span>
            {t('report.topics.other_info')}
          </button>
          <button type="button" className="report-topic-btn" onClick={() => setOtherSubtopic('suggest_description')}>
            <span className="report-topic-icon">📝</span>
            {t('report.suggestDescription')}
          </button>
          <div className="sf-actions">
            <button className="sf-cancel" onClick={() => setTopic(null)}>← {t('report.back')}</button>
          </div>
        </div>
      )}

      {topic === 'other_info' && otherSubtopic === 'generic' && (
        <>
          <div className="sf-field">
            <label>{t('report.noteLabel')}</label>
            <textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('report.notePlaceholder')} />
          </div>
          {nameRow}
          {error && <div className="sf-error">{error}</div>}
          <div className="sf-actions">
            <button className="sf-cancel" onClick={() => setOtherSubtopic(null)}>← {t('report.back')}</button>
            <button className="sf-submit" onClick={submitOtherInfo} disabled={loading}>
              {loading ? '...' : t('submission.submit')}
            </button>
          </div>
        </>
      )}

      {topic === 'other_info' && otherSubtopic === 'suggest_description' && (
        <>
          <div className="sf-field">
            <label>📝 {t('report.suggestDescription')}</label>
            <textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('report.descriptionPlaceholder')} />
          </div>
          <p className="report-closed-text">{t('report.descriptionHint')}</p>
          {nameRow}
          {error && <div className="sf-error">{error}</div>}
          <div className="sf-actions">
            <button className="sf-cancel" onClick={() => setOtherSubtopic(null)}>← {t('report.back')}</button>
            <button className="sf-submit" onClick={submitDescription} disabled={loading}>
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
