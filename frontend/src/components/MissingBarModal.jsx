import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { searchNominatim, submitNewVenue } from '../hooks/useApi';
import MiniMapPreview from './MiniMapPreview';
import BrandCombobox from './BrandCombobox';
import { parsePrice, formatEuro, pricePlaceholder } from '../utils/price';

const TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];
const NEIGHBOURHOODS = [
  { id: 'altstadt', de: 'Altstadt', en: 'Old Town' },
  { id: 'maxvorstadt', de: 'Maxvorstadt', en: 'Maxvorstadt' },
  { id: 'schwabing', de: 'Schwabing', en: 'Schwabing' },
  { id: 'isarvorstadt', de: 'Isarvorstadt', en: 'Isarvorstadt' },
];

function emptyForm() {
  return {
    name: '', type: 'restaurant', address: '', neighbourhood_id: 'altstadt',
    lat: '', lng: '', beer_brand: '', size_05: '', size_mass: '',
    submitter_name: '', anonymous: false,
    visit_date: new Date().toISOString().split('T')[0],
    photo: null,
  };
}

export default function MissingBarModal({ allVenues, onClose, onCreated }) {
  const { t, i18n } = useTranslation();
  const de = i18n.language === 'de';
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Live local match against the existing database — cheap client-side filter,
  // no rate limit to worry about, so this runs on every keystroke.
  const dbMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    return (allVenues || []).filter((v) => v.name.toLowerCase().includes(q)).slice(0, 4);
  }, [allVenues, query]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const r = await searchNominatim(`${query.trim()}, München`);
      setResults(r);
    } catch {
      setSearchError(t('missingBar.searchError'));
      setResults([]);
    }
    setSearching(false);
  };

  const pickResult = (r) => {
    set('name', query.trim() || r.display_name.split(',')[0]);
    setForm((f) => ({
      ...f,
      name: f.name || r.display_name.split(',')[0],
      address: r.display_name,
      lat: r.lat,
      lng: r.lon,
    }));
    setStep(2);
  };

  const addManually = () => {
    setForm((f) => ({ ...f, name: query.trim() || f.name }));
    setStep(2);
  };

  const step2Error = () => {
    if (!form.name.trim()) return t('missingBar.errName');
    if (!form.neighbourhood_id) return t('missingBar.errNeighbourhood');
    if (!form.beer_brand.trim()) return t('missingBar.errBrand');
    if (parsePrice(form.size_05) == null) return t('missingBar.errPrice');
    return '';
  };

  const goToStep3 = () => {
    const err = step2Error();
    if (err) { setSubmitError(err); return; }
    setSubmitError('');
    setStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    const fd = new FormData();
    fd.append('name', form.name.trim());
    fd.append('type', form.type);
    fd.append('neighbourhood_id', form.neighbourhood_id);
    fd.append('address', form.address);
    if (form.lat) fd.append('lat', form.lat);
    if (form.lng) fd.append('lng', form.lng);
    fd.append('beer_brand', form.beer_brand.trim());
    fd.append('size_05', parsePrice(form.size_05));
    const mass = parsePrice(form.size_mass);
    if (mass != null) fd.append('size_mass', mass);
    fd.append('visit_date', form.visit_date);
    fd.append('submitter_name', form.anonymous ? 'Anonym' : form.submitter_name);
    if (form.photo) fd.append('photo', form.photo);

    try {
      await submitNewVenue(fd);
      setSuccess(true);
      onCreated?.();
    } catch (err) {
      setSubmitError(err.message);
    }
    setSubmitting(false);
  };

  const resolvedPrice05 = parsePrice(form.size_05);
  const resolvedPriceMass = parsePrice(form.size_mass);
  const typeLabel = t(`filters.types.${form.type}`);
  const hoodLabel = de
    ? NEIGHBOURHOODS.find((n) => n.id === form.neighbourhood_id)?.de
    : NEIGHBOURHOODS.find((n) => n.id === form.neighbourhood_id)?.en;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card missing-bar-card" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="missing-bar-success">
            <div className="mb-success-icon">🍺</div>
            <p>{t('missingBar.success')}</p>
            <button className="sf-submit" onClick={onClose}>{t('admin.venues.close')}</button>
          </div>
        ) : (
          <>
            <div className="missing-bar-header">
              <div className="missing-bar-title">🍺 {t('missingBar.title')}</div>
              <button className="panel-close" onClick={onClose}>✕</button>
            </div>
            <div className="missing-bar-steps">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`mb-step-dot ${step === s ? 'active' : step > s ? 'done' : ''}`}>{s}</div>
              ))}
            </div>

            {/* STEP 1 — search */}
            {step === 1 && (
              <div className="missing-bar-step">
                <div className="sf-field">
                  <label>{t('missingBar.searchLabel')}</label>
                  <div className="mb-search-row">
                    <input
                      type="text" value={query} placeholder={t('missingBar.searchPlaceholder')}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    />
                    <button className="mb-search-btn" onClick={runSearch} disabled={searching || !query.trim()}>
                      {searching ? '...' : '🔍'}
                    </button>
                  </div>
                </div>

                {dbMatches.length > 0 && (
                  <div className="mb-db-warning">
                    ⚠️ {t('missingBar.mightExist')}
                    <ul>
                      {dbMatches.map((v) => (
                        <li key={v.id}>{t('missingBar.didYouMean', { name: v.name })}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {searchError && <div className="sf-error">{searchError}</div>}

                {results && results.length > 0 && (
                  <div className="mb-results">
                    {results.map((r) => (
                      <button key={r.place_id} type="button" className="mb-result-item" onClick={() => pickResult(r)}>
                        <div className="mb-result-name">{r.display_name.split(',')[0]}</div>
                        <div className="mb-result-addr">{r.display_name}</div>
                      </button>
                    ))}
                  </div>
                )}
                {results && results.length === 0 && (
                  <div className="mb-no-results">{t('missingBar.noResults')}</div>
                )}

                <button className="mb-manual-btn" onClick={addManually}>{t('missingBar.addManually')}</button>
              </div>
            )}

            {/* STEP 2 — details */}
            {step === 2 && (
              <div className="missing-bar-step">
                <div className="vm-form-grid">
                  <div className="sf-field">
                    <label>{t('admin.venues.name')}</label>
                    <input value={form.name} onChange={(e) => set('name', e.target.value)} />
                  </div>
                  <div className="sf-field">
                    <label>{t('filters.type')}</label>
                    <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                      {TYPES.map((ty) => <option key={ty} value={ty}>{t(`filters.types.${ty}`)}</option>)}
                    </select>
                  </div>
                  <div className="sf-field">
                    <label>{t('venue.address')}</label>
                    <input value={form.address} onChange={(e) => set('address', e.target.value)} />
                  </div>
                  <div className="sf-field">
                    <label>{t('filters.neighbourhood')}</label>
                    <select value={form.neighbourhood_id} onChange={(e) => set('neighbourhood_id', e.target.value)}>
                      {NEIGHBOURHOODS.map((n) => <option key={n.id} value={n.id}>{de ? n.de : n.en}</option>)}
                    </select>
                  </div>
                </div>

                <div className="sf-field">
                  <label>{t('submission.brand')}</label>
                  <BrandCombobox
                    value={form.beer_brand}
                    onChange={(v) => set('beer_brand', v)}
                    placeholder={t('brandPicker.placeholder')}
                    id="missing-bar-brand"
                  />
                </div>

                <div className="sf-row">
                  <div className="sf-field half">
                    <label>{t('venue.price05')}</label>
                    <input value={form.size_05} onChange={(e) => set('size_05', e.target.value)} inputMode="decimal" placeholder={pricePlaceholder(i18n.language)} />
                  </div>
                  <div className="sf-field half">
                    <label>{t('missingBar.priceMassOptional')}</label>
                    <input value={form.size_mass} onChange={(e) => set('size_mass', e.target.value)} inputMode="decimal" placeholder={pricePlaceholder(i18n.language)} />
                  </div>
                </div>

                <div className="sf-field">
                  <label>{t('submission.date')}</label>
                  <input type="date" value={form.visit_date} onChange={(e) => set('visit_date', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                </div>

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

                <div className="sf-field">
                  <label>{t('missingBar.photoOptional')}</label>
                  <input type="file" accept="image/*" onChange={(e) => set('photo', e.target.files?.[0] || null)} />
                </div>

                {submitError && <div className="sf-error">{submitError}</div>}

                <div className="sf-actions">
                  <button className="sf-cancel" onClick={() => setStep(1)}>← {t('report.back')}</button>
                  <button className="sf-submit" onClick={goToStep3}>{t('missingBar.continue')}</button>
                </div>
              </div>
            )}

            {/* STEP 3 — confirmation */}
            {step === 3 && (
              <div className="missing-bar-step">
                <div className="mb-summary">
                  <div className="mb-summary-name">{form.name}</div>
                  <div className="mb-summary-row">{typeLabel} · {hoodLabel}</div>
                  {form.address && <div className="mb-summary-row">📍 {form.address}</div>}
                  <div className="mb-summary-row">🍺 {form.beer_brand} — {formatEuro(resolvedPrice05, i18n.language)}{resolvedPriceMass != null ? ` / ${formatEuro(resolvedPriceMass, i18n.language)} (Maß)` : ''}</div>
                  <div className="mb-summary-row">📅 {form.visit_date}</div>
                  {form.photo && <div className="mb-summary-row">📷 {form.photo.name}</div>}
                </div>

                <MiniMapPreview lat={form.lat ? parseFloat(form.lat) : null} lng={form.lng ? parseFloat(form.lng) : null} />
                {!form.lat && <div className="mb-no-coords">{t('missingBar.noCoords')}</div>}

                {submitError && <div className="sf-error">{submitError}</div>}

                <div className="sf-actions">
                  <button className="sf-cancel" onClick={() => setStep(2)}>← {t('report.back')}</button>
                  <button className="sf-submit" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? '...' : t('submission.submit')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
