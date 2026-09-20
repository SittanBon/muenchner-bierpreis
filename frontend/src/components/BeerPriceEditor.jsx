import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminUpdateBeerPrice, adminVerifyBeer } from '../hooks/useApi';
import { parsePrice, pricePlaceholder } from '../utils/price';
import { SERVING_SIZES, SOURCE_TYPES, NOTES_MAX_LENGTH, normalizePrice, formatPrice } from '../utils/priceUtils';
import { todayISO } from '../utils/freshness';
import { useToast } from '../hooks/useToast';
import FreshnessLight from './FreshnessLight';
import PriceHistoryTable from './PriceHistoryTable';

const SERVE_TYPES = ['tap', 'bottle', 'can', 'unknown'];
const SERVE_EMOJI = { tap: '🍺', bottle: '🍾', can: '🥫', unknown: '❓' };

// The admin price editor for ONE beer at a venue.
//
//  - Actual price (required), serving size, and a live, read-only per-0.5 L
//    comparison price that updates as you type.
//  - "Price observed on" (when the price was actually seen), source, and an
//    internal note (never shown publicly).
//  - Save never sets verified_at. Only the separate "✓ Verify price" button does,
//    and it sends no price at all — so it can't change one. Verify is disabled
//    while there are unsaved edits (it confirms the SAVED price).
//
// The parent remounts this (via `key`) whenever the saved beer changes, so the
// local form state always starts from what is actually stored.
export default function BeerPriceEditor({
  token, venue, beer, onUpdated, onDelete, deleting, canDelete, historyOpen, onToggleHistory,
}) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const lang = i18n.language;

  const [price, setPrice] = useState(String(beer.size_05 ?? ''));
  const [volume, setVolume] = useState(beer.serving_volume_ml == null ? '' : String(beer.serving_volume_ml));
  const [serve, setServe] = useState(beer.serve_type || 'unknown');
  const [observed, setObserved] = useState(beer.price_observed_at || '');
  const [observedDirty, setObservedDirty] = useState(false);
  const [source, setSource] = useState(beer.source_type || '');
  const [sourceDirty, setSourceDirty] = useState(false);
  const [notes, setNotes] = useState(beer.notes || '');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  const parsed = parsePrice(price);
  const volumeMl = volume === '' ? null : Number(volume);
  // Live comparison price. Unknown size -> no comparison at all (never assume 0.5 L).
  const normalized = parsed != null && volumeMl != null ? normalizePrice(parsed, volumeMl) : null;

  const dirty = price !== String(beer.size_05 ?? '')
    || volume !== (beer.serving_volume_ml == null ? '' : String(beer.serving_volume_ml))
    || serve !== (beer.serve_type || 'unknown')
    || notes !== (beer.notes || '')
    || observedDirty || sourceDirty;

  const save = async () => {
    setError('');
    if (parsed == null) { setError(t('admin.venues.errPrice')); return; }
    setSaving(true);
    try {
      const updated = await adminUpdateBeerPrice(token, venue.id, beer.id, {
        size_05: parsed,
        size_mass: beer.size_mass,
        serve_type: serve,
        serving_volume_ml: volumeMl,
        notes,
        // Only what the admin actually touched: an untouched date/source must
        // not be re-sent, or a price change would keep the OLD observation
        // date instead of getting "today" and the ADMIN source.
        ...(observedDirty && observed ? { price_observed_at: observed } : {}),
        ...(sourceDirty ? { source_type: source } : {}),
      });
      showToast('success', t('admin.toast.priceSaved', { venue: venue.name }));
      setHistoryKey((k) => k + 1);
      // If the save changed something the parent remounts this editor with
      // fresh state; if the server treated it as a no-op nothing remounts, so
      // clear our own busy/dirty flags either way.
      setObservedDirty(false);
      setSourceDirty(false);
      setSaving(false);
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const verify = async () => {
    setError('');
    setVerifying(true);
    try {
      const updated = await adminVerifyBeer(token, venue.id, beer.id);
      showToast('success', t('admin.toast.priceVerified', { venue: venue.name }));
      setHistoryKey((k) => k + 1);
      setVerifying(false);
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
      setVerifying(false);
    }
  };

  const id = `pe-${beer.id}`;
  return (
    <div className="vm-beer-card">
      <div className="vm-beer-head">
        <strong className="vm-beer-brand">{beer.brand}</strong>
        <FreshnessLight beer={beer} />
      </div>

      <div className="vm-beer-grid">
        <div className="pe-field">
          <label htmlFor={`${id}-price`}>{t('admin.price.price')} *</label>
          <input
            id={`${id}-price`} className="vm-price-input" inputMode="decimal" required
            placeholder={pricePlaceholder(lang)} value={price} onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="pe-field">
          <label htmlFor={`${id}-size`}>{t('admin.price.size')}</label>
          <select id={`${id}-size`} className="vm-serve-select" value={volume} onChange={(e) => setVolume(e.target.value)}>
            <option value="">{t('admin.price.sizeUnknown')}</option>
            {SERVING_SIZES.map(({ ml }) => <option key={ml} value={ml}>{t(`admin.price.size${ml}`)}</option>)}
          </select>
        </div>

        <div className="pe-field">
          <label>{t('admin.price.normalized')}</label>
          <div className="pe-normalized" aria-live="polite" title={t('admin.price.normalizedHint')}>
            {normalized != null ? formatPrice(normalized, lang) : t('admin.price.normalizedUnknown')}
          </div>
        </div>

        <div className="pe-field">
          <label htmlFor={`${id}-observed`}>{t('admin.price.observed')}</label>
          <input
            id={`${id}-observed`} type="date" className="vm-price-input" max={todayISO()}
            value={observed} title={t('admin.price.observedHint')}
            onChange={(e) => { setObserved(e.target.value); setObservedDirty(true); }}
          />
        </div>

        <div className="pe-field">
          <label htmlFor={`${id}-source`}>{t('admin.price.source')}</label>
          <select
            id={`${id}-source`} className="vm-serve-select" value={source}
            onChange={(e) => { setSource(e.target.value); setSourceDirty(true); }}
          >
            <option value="">{t('admin.price.sourceUnknown')}</option>
            {SOURCE_TYPES.map((s) => <option key={s} value={s}>{t(`admin.price.sources.${s}`)}</option>)}
          </select>
        </div>

        <div className="pe-field">
          <label htmlFor={`${id}-serve`}>{t('serveType.question')}</label>
          <select id={`${id}-serve`} className="vm-serve-select" value={serve} onChange={(e) => setServe(e.target.value)}>
            {SERVE_TYPES.map((s) => <option key={s} value={s}>{SERVE_EMOJI[s]} {t(`serveType.${s}`)}</option>)}
          </select>
        </div>
      </div>

      <div className="pe-field pe-notes">
        <label htmlFor={`${id}-notes`}>{t('admin.price.notes')} <span className="pe-hint">— {t('admin.price.notesHint')}</span></label>
        <textarea
          id={`${id}-notes`} rows={2} maxLength={NOTES_MAX_LENGTH} value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <div className="sf-error">{error}</div>}

      <div className="vm-beer-actions">
        <button type="button" className="vm-save-beer" onClick={save} disabled={saving || !dirty} title={t('admin.price.saveHint')}>
          {saving ? '...' : t('admin.price.save')}
        </button>
        <button
          type="button" className="vm-verify" onClick={verify}
          disabled={verifying || dirty}
          title={dirty ? t('admin.price.verifySaveFirst') : t('admin.venues.verifyHint')}
        >
          {verifying ? '...' : t('admin.venues.verify')}
        </button>
        <button type="button" className="vm-history-btn" onClick={onToggleHistory} aria-expanded={historyOpen}>
          {historyOpen ? t('admin.price.hideHistory') : t('admin.price.showHistory')}
        </button>
        <button
          type="button" className="vm-delete-beer" onClick={onDelete} disabled={deleting || !canDelete}
          title={!canDelete ? t('admin.venues.lastBeer') : t('admin.venues.deleteBeer')}
        >
          {deleting ? '...' : `🗑 ${t('admin.venues.deleteBeer')}`}
        </button>
      </div>

      {historyOpen && (
        <PriceHistoryTable key={historyKey} token={token} venueId={venue.id} beerId={beer.id} />
      )}
    </div>
  );
}
