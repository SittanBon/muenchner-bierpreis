import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminUpdateBeerPrice, adminVerifyBeer, adminConfirmBeerSize } from '../hooks/useApi';
import { parsePrice, pricePlaceholder } from '../utils/price';
import { SOURCE_TYPES, NOTES_MAX_LENGTH, normalizePrice, formatPrice } from '../utils/priceUtils';
import { todayISO } from '../utils/freshness';
import { useToast } from '../hooks/useToast';
import FreshnessLight from './FreshnessLight';
import ServingSizeSelect from './ServingSizeSelect';
import ServeTypeSelect from './ServeTypeSelect';
import PriceHistoryTable from './PriceHistoryTable';


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
  // Only sent to the server when the admin actually touches the size select
  // (same "only what was touched" convention as observedDirty/sourceDirty) —
  // that touch is itself what confirms the size (Fix 3), so an untouched
  // field must not silently re-confirm whatever was already stored.
  const [volumeDirty, setVolumeDirty] = useState(false);
  const [serve, setServe] = useState(beer.serve_type || 'unknown');
  const [observed, setObserved] = useState(beer.price_observed_at || '');
  const [observedDirty, setObservedDirty] = useState(false);
  const [source, setSource] = useState(beer.source_type || '');
  const [sourceDirty, setSourceDirty] = useState(false);
  const [notes, setNotes] = useState(beer.notes || '');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmingSize, setConfirmingSize] = useState(false);
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
        notes,
        // Only what the admin actually touched: an untouched date/source must
        // not be re-sent, or a price change would keep the OLD observation
        // date instead of getting "today" and the ADMIN source. Same for the
        // serving size — sending it unconditionally would confirm a size the
        // admin never actually looked at (Fix 3).
        ...(observedDirty && observed ? { price_observed_at: observed } : {}),
        ...(sourceDirty ? { source_type: source } : {}),
        ...(volumeDirty ? { serving_volume_ml: volumeMl } : {}),
      });
      showToast('success', t('admin.toast.priceSaved', { venue: venue.name }));
      setHistoryKey((k) => k + 1);
      // If the save changed something the parent remounts this editor with
      // fresh state; if the server treated it as a no-op nothing remounts, so
      // clear our own busy/dirty flags either way.
      setObservedDirty(false);
      setSourceDirty(false);
      setVolumeDirty(false);
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

  // "This serving size is correct" (Fix 3) — its own action, distinct from
  // Save, for the common case where the admin reviews an ASSUMED_HALF_LITRE
  // flag and the assumed size turns out to be right. Disabled while there are
  // unsaved edits, same reasoning as Verify: it confirms the SAVED size.
  const confirmSize = async () => {
    setError('');
    setConfirmingSize(true);
    try {
      const updated = await adminConfirmBeerSize(token, venue.id, beer.id);
      showToast('success', t('admin.toast.sizeConfirmed', { venue: venue.name }));
      setConfirmingSize(false);
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
      setConfirmingSize(false);
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
          <ServingSizeSelect
            id={`${id}-size`} className="vm-serve-select" value={volume}
            onChange={(v) => { setVolume(v); setVolumeDirty(true); }} allowUnknown
          />
          <button
            type="button" className="pe-confirm-size" onClick={confirmSize}
            disabled={confirmingSize || dirty || volume === '' || beer.size_confirmed}
            title={dirty ? t('admin.price.confirmSizeSaveFirst') : t('admin.price.confirmSizeHint')}
          >
            {confirmingSize ? '...' : beer.size_confirmed ? `✓ ${t('admin.price.sizeConfirmed')}` : t('admin.price.confirmSize')}
          </button>
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
          <ServeTypeSelect id={`${id}-serve`} className="vm-serve-select" value={serve} onChange={setServe} unknownKey="serveType.unknown" />
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
