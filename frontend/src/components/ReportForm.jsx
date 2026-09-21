import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, X } from 'lucide-react';
import { submitReport } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { parsePrice } from '../utils/price';
import { formatPrice } from '../utils/priceUtils';
import { todayISO } from '../utils/freshness';
import {
  TOPICS, PRICE_TOPICS, WRONG_FIELDS, NOTE_MAX,
  beerForBrand, knownSizeMl, initialPriceForm, validateReport, buildPayload,
} from '../utils/reportFlow';
import { DEFAULT_SERVING_ML, servingLabel } from '../constants/servingSizes';
import { serveTypeText } from '../constants/serveTypes';
import ServingSizeSelect from './ServingSizeSelect';
import ServeTypeSelect from './ServeTypeSelect';
import BrandCombobox from './BrandCombobox';
import VenuePicker from './VenuePicker';
import { useFocusTrap } from '../hooks/useFocusTrap';

const AUTO_CLOSE_MS = 3000;

// The confirmation screen: a drawn green check, thanks, a summary of what was sent, and a
// "Schließen" button — it also closes itself after 3 seconds. It shows nothing internal (no
// submission id, status or queue information).
function ReportDone({ lines, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    const id = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div className="report-done" role="status">
      <svg className="report-check" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="report-check-circle" cx="26" cy="26" r="24" />
        <path className="report-check-tick" d="M14 27l8 8 16-17" />
      </svg>
      <h3 className="report-done-title">{t('report.doneTitle')}</h3>
      <p className="report-done-text">{t('report.doneText')}</p>
      <ul className="report-summary">
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <button type="button" className="btn-amber report-done-close" onClick={onClose}>{t('report.close')}</button>
    </div>
  );
}

// "+ Preis melden": (venue) → what are you reporting? → details → thanks.
//   * Opened with a venue (the venue sheet, "Preis falsch?"): starts at the topic step — or,
//     with `initialTopic`, straight at that topic's details, pre-filled.
//   * Opened without one (bottom nav): starts by choosing the venue.
// Every entry lands in the same admin queue, labelled by report_type (unchanged API).
export default function ReportForm({ venues, venue: initialVenue = null, initialTopic = null, onClose, onNewVenue }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const showToast = useToast();
  const [venue, setVenue] = useState(initialVenue);
  const [topic, setTopic] = useState(initialTopic);
  const [form, setForm] = useState(() => ({
    ...(initialTopic && PRICE_TOPICS.includes(initialTopic) ? initialPriceForm(initialVenue, initialTopic) : { beer_brand: '', size_ml: DEFAULT_SERVING_ML }),
    price: '', serve_type: 'unknown', visit_date: todayISO(),
    submitter_name: '', anonymous: false, note: '', wrong_field: '',
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // the summary lines once submitted
  const sizeTouched = useRef(false);
  const rootRef = useRef(null);

  const step = sent ? 'done' : !venue ? 'venue' : !topic ? 'topic' : 'details';
  const stepNumber = { topic: 1, details: 2, done: 3 }[step];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Escape closes the sheet — but NOT while focus is in a form field: there Escape belongs to the
  // field (closing the brand dropdown, clearing a search) and must never throw away what was typed.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.target?.closest?.('input, textarea, select')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Focus moves into the dialog, Tab stays inside it, and focus goes back to the opener on close.
  useFocusTrap(rootRef, { open: true });

  const chooseTopic = (key) => {
    sizeTouched.current = false;
    setForm((f) => ({
      ...f,
      ...(PRICE_TOPICS.includes(key) ? initialPriceForm(venue, key) : {}),
      note: '', wrong_field: '',
    }));
    setError('');
    setTopic(key);
  };

  // Typing/picking a brand the venue already lists fills in that beer's serving size — unless
  // the visitor has already chosen one.
  const setBrand = (brand) => {
    setForm((f) => {
      const beer = beerForBrand(venue, brand);
      const size = knownSizeMl(beer);
      return { ...f, beer_brand: brand, ...(!sizeTouched.current && size ? { size_ml: size } : {}) };
    });
  };

  const back = () => {
    setError('');
    if (step === 'details') setTopic(null);
    else if (step === 'topic' && !initialVenue) setVenue(null);
  };
  const canGoBack = step === 'details' || (step === 'topic' && !initialVenue);

  const summary = () => {
    const lines = [venue.name, t(`report.topics.${topic === 'suggest_description' ? 'other_info' : topic}`)];
    if (PRICE_TOPICS.includes(topic)) {
      const serve = serveTypeText(form.serve_type, lang);
      lines.push([form.beer_brand.trim(), servingLabel(Number(form.size_ml), lang), formatPrice(parsePrice(form.price), lang), serve].filter(Boolean).join(' · '));
      lines.push(`${t('report.seenOn')} ${new Date(`${form.visit_date}T00:00:00`).toLocaleDateString(lang)}`);
    } else if (topic === 'other_info') {
      if (form.wrong_field) lines.push(t(`report.fields.${form.wrong_field}`));
      lines.push(`„${form.note.trim()}“`);
    } else if (topic === 'suggest_description') {
      lines.push(`„${form.note.trim()}“`);
    }
    return lines;
  };

  const submit = async () => {
    const err = validateReport(topic, form);
    if (err) { setError(t(err)); return; }
    setLoading(true);
    setError('');
    try {
      await submitReport(buildPayload(topic, venue, form));
      setSent(summary());
    } catch (e) {
      setError(e.message || t('submission.error'));
      showToast('error', t('toast.genericError'));
    }
    setLoading(false);
  };

  const nameRow = (
    <div className="sf-field">
      <label htmlFor="report-name">{t('submission.name')}</label>
      <div className="sf-name-row">
        <input
          id="report-name" type="text" placeholder={t('submission.namePlaceholder')}
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

  const actions = (submitLabel, onSubmit) => (
    <div className="sf-actions">
      <button type="button" className="sf-cancel" onClick={back}>← {t('report.back')}</button>
      <button type="button" className="sf-submit" onClick={onSubmit} disabled={loading}>{loading ? '…' : submitLabel}</button>
    </div>
  );
  const noteField = (labelKey, placeholderKey) => (
    <div className="sf-field">
      <label htmlFor="report-note">{t(labelKey)}</label>
      <textarea id="report-note" rows={4} maxLength={NOTE_MAX} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t(placeholderKey)} />
      <div className="mb-char-count">{form.note.length}/{NOTE_MAX}</div>
    </div>
  );

  // Clicking outside closes — but not while someone is typing a report.
  const onOverlay = () => { if (step !== 'details') onClose(); };

  const title = step === 'venue' ? t('report.pickTitle')
    : step === 'topic' ? t('report.title')
      : step === 'details' ? t(`report.topics.${topic === 'suggest_description' ? 'other_info' : topic}`)
        : null;

  return (
    <div className="modal-overlay report-overlay" onClick={onOverlay}>
      <div
        ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('report.button')}
        className="report-sheet" onClick={(e) => e.stopPropagation()}
      >
        {step !== 'done' && (
          <div className="report-head">
            <div className="report-head-text">
              {venue && <div className="report-venue">{venue.name}</div>}
              <h2 className="report-title">{title}</h2>
              {stepNumber && stepNumber < 3 && <div className="report-stepno">{t('report.stepOf', { n: stepNumber, total: 3 })}</div>}
            </div>
            <button type="button" className="report-x" onClick={onClose} aria-label={t('report.close')}><X size={22} aria-hidden="true" /></button>
          </div>
        )}

        {step === 'venue' && <VenuePicker venues={venues} onPick={(v) => { setVenue(v); setError(''); }} onNewVenue={onNewVenue} />}

        {step === 'topic' && (
          <>
            <div className="report-cards">
              {TOPICS.map((tp) => (
                <button key={tp.key} type="button" className="report-card-btn" onClick={() => chooseTopic(tp.key)}>
                  <span className="report-card-icon" aria-hidden="true">{tp.icon}</span>
                  <span className="report-card-label">{t(`report.topics.${tp.key}`)}</span>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="button" className="report-link" onClick={() => chooseTopic('suggest_description')}>📝 {t('report.suggestDescription')}</button>
            {canGoBack && <div className="sf-actions"><button type="button" className="sf-cancel" onClick={back}>← {t('report.back')}</button></div>}
          </>
        )}

        {step === 'details' && PRICE_TOPICS.includes(topic) && (
          <>
            <div className="sf-field">
              <label htmlFor="report-brand">{t('submission.brand')}</label>
              <BrandCombobox value={form.beer_brand} onChange={setBrand} placeholder={t('brandPicker.placeholder')} id="report-brand" />
            </div>
            <div className="sf-row">
              <div className="sf-field half">
                <label htmlFor="report-size">{t('submission.size')}</label>
                <ServingSizeSelect
                  id="report-size" value={form.size_ml} placeholder={t('report.chooseSize')}
                  onChange={(v) => { sizeTouched.current = true; set('size_ml', v === '' ? '' : Number(v)); }}
                />
              </div>
              <div className="sf-field half">
                <label htmlFor="report-price">{t('report.newPrice')}</label>
                <input id="report-price" type="text" inputMode="decimal" placeholder={t('submission.pricePlaceholder')} value={form.price} onChange={(e) => set('price', e.target.value)} />
              </div>
            </div>
            <div className="sf-field">
              <label htmlFor="report-serve">{t('report.serveOptional')}</label>
              <ServeTypeSelect id="report-serve" value={form.serve_type} onChange={(v) => set('serve_type', v)} />
            </div>
            <div className="sf-field">
              <label htmlFor="report-date">{t('report.whenSeen')}</label>
              <input id="report-date" type="date" value={form.visit_date} max={todayISO()} onChange={(e) => set('visit_date', e.target.value)} />
            </div>
            {nameRow}
            {error && <div className="sf-error" role="alert">{error}</div>}
            {actions(t('submission.submit'), submit)}
          </>
        )}

        {step === 'details' && topic === 'closed' && (
          <div className="report-closed">
            <p className="report-closed-q">{t('report.closedSure')}</p>
            <p className="report-closed-text">{t('report.closedConfirm', { venue: venue.name })}</p>
            {error && <div className="sf-error" role="alert">{error}</div>}
            <button type="button" className="report-closed-yes" onClick={submit} disabled={loading}>{loading ? '…' : t('report.confirmClosed')}</button>
            <button type="button" className="btn-outline report-closed-no" onClick={back}>{t('report.closedNo')}</button>
          </div>
        )}

        {step === 'details' && topic === 'other_info' && (
          <>
            <div className="sf-field">
              <label htmlFor="report-field">{t('report.whichField')}</label>
              <select id="report-field" value={form.wrong_field} onChange={(e) => set('wrong_field', e.target.value)}>
                <option value="">{t('report.fieldNone')}</option>
                {WRONG_FIELDS.map((f) => <option key={f} value={f}>{t(`report.fields.${f}`)}</option>)}
              </select>
            </div>
            {noteField('report.noteLabel', 'report.notePlaceholder')}
            {nameRow}
            {error && <div className="sf-error" role="alert">{error}</div>}
            {actions(t('submission.submit'), submit)}
          </>
        )}

        {step === 'details' && topic === 'suggest_description' && (
          <>
            {noteField('report.suggestDescription', 'report.descriptionPlaceholder')}
            <p className="report-closed-text">{t('report.descriptionHint')}</p>
            {nameRow}
            {error && <div className="sf-error" role="alert">{error}</div>}
            {actions(t('submission.submit'), submit)}
          </>
        )}

        {step === 'done' && <ReportDone lines={sent} onClose={onClose} />}
      </div>
    </div>
  );
}
