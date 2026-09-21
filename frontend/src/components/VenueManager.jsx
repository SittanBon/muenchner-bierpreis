import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchNeighbourhoods, adminFetchVenues, adminCreateVenue, adminUpdateVenue,
  adminDeleteVenue, adminAddBeer, adminDeleteBeer,
} from '../hooks/useApi';
import { parsePrice, formatEuro, pricePlaceholder } from '../utils/price';
import { formatVolume } from '../utils/priceUtils';
import { useToast } from '../hooks/useToast';
import BrandCombobox from './BrandCombobox';
import BeerPriceEditor from './BeerPriceEditor';
import { venueMatchesQuery } from '../utils/adminSearch';
import { flagSeverity } from '../utils/dataQualityFlags';
import { DEFAULT_SERVING_ML, servingLabel } from '../constants/servingSizes';
import ServingSizeSelect from './ServingSizeSelect';
import SharedServeTypeSelect from './ServeTypeSelect';
import FreshnessLight from './FreshnessLight';
import { VENUE_TYPES } from '../constants/venueTypes';
import { neighbourhoodName } from '../utils/neighbourhoods';


function emptyBeer() { return { brand: '', size_05: '', size_mass: '', serve_type: 'unknown', serving_volume_ml: String(DEFAULT_SERVING_ML) }; }

// Price + serving size (+ the optional 1 L "Maß" price) for one beer row — shared
// by the add-venue form and the add-beer form so both offer the same sizes.
// A price is only meaningful with its size, so the size is chosen here, not
// assumed; the separate Maß price is hidden when the headline size is already 1 L.
function BeerPriceInputs({ value, onField }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <div className="vm-price-field">
        <span className="vm-price-field-label">{t('admin.venues.priceLabel')}</span>
        <input
          className="vm-price-input" placeholder={pricePlaceholder(i18n.language)} inputMode="decimal"
          value={value.size_05} onChange={(e) => onField('size_05', e.target.value)}
        />
      </div>
      <ServingSizeSelect
        className="vm-serve-select" value={value.serving_volume_ml} aria-label={t('admin.price.size')}
        onChange={(v) => onField('serving_volume_ml', v)}
      />
      {Number(value.serving_volume_ml) !== 1000 && (
        <div className="vm-price-field">
          <span className="vm-price-field-label">{servingLabel(1000, i18n.language)}</span>
          <input
            className="vm-price-input" placeholder={pricePlaceholder(i18n.language)} inputMode="decimal"
            value={value.size_mass} onChange={(e) => onField('size_mass', e.target.value)}
          />
        </div>
      )}
    </>
  );
}

function ServeTypeSelect({ value, onChange, id }) {
  return <SharedServeTypeSelect id={id} className="vm-serve-select" value={value} onChange={onChange} unknownKey="serveType.unknown" />;
}

function detailsFromVenue(venue) {
  return {
    name: venue.name || '',
    type: venue.type || 'restaurant',
    neighbourhood_id: venue.neighbourhood_id || '',
    address: venue.address || '',
    lat: venue.lat ?? '',
    lng: venue.lng ?? '',
    opening_hours: venue.opening_hours || '',
    website: venue.website || '',
    description_de: venue.description_de || '',
    description_en: venue.description_en || '',
    active: venue.active !== false,
  };
}

function AddVenueForm({ token, neighbourhoods, onCreated, onCancel }) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const [form, setForm] = useState({
    name: '', type: 'restaurant', neighbourhood_id: neighbourhoods[0]?.id || '',
    address: '', lat: '', lng: '', opening_hours: '', website: '',
  });
  const [beers, setBeers] = useState([emptyBeer()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setBeer = (i, k, v) => setBeers((bs) => bs.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));
  const addBeerRow = () => setBeers((bs) => [...bs, emptyBeer()]);
  const removeBeerRow = (i) => setBeers((bs) => bs.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError('');
    if (!form.name || !form.neighbourhood_id) {
      setError(t('admin.venues.errName'));
      return;
    }
    // Prices may be typed with a comma (German) or dot (English) decimal.
    const cleanBeers = beers
      .filter((b) => b.brand && b.size_05)
      .map((b) => ({
        brand: b.brand, size_05: parsePrice(b.size_05), serve_type: b.serve_type,
        serving_volume_ml: Number(b.serving_volume_ml),
        size_mass: Number(b.serving_volume_ml) === 1000 ? null : parsePrice(b.size_mass),
      }));
    if (cleanBeers.length === 0 || cleanBeers.some((b) => b.size_05 == null)) {
      setError(t('admin.venues.errBeer'));
      return;
    }
    setSaving(true);
    try {
      await adminCreateVenue(token, {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        beers: cleanBeers,
      });
      showToast('success', t('admin.toast.venueAdded', { venue: form.name }));
      onCreated();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="vm-form">
      <div className="vm-form-title">{t('admin.venues.addTitle')}</div>
      <div className="vm-form-grid">
        <div className="sf-field">
          <label>{t('admin.venues.name')}</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="sf-field">
          <label>{t('filters.type')}</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {VENUE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`filters.types.${ty}`)}</option>)}
          </select>
        </div>
        <div className="sf-field">
          <label>{t('filters.neighbourhood')}</label>
          <select value={form.neighbourhood_id} onChange={(e) => set('neighbourhood_id', e.target.value)}>
            {neighbourhoods.map((n) => <option key={n.id} value={n.id}>{neighbourhoodName(n, i18n.language)}</option>)}
          </select>
        </div>
        <div className="sf-field">
          <label>{t('venue.address')}</label>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="sf-row">
          <div className="sf-field half">
            <label>Lat</label>
            <input value={form.lat} onChange={(e) => set('lat', e.target.value)} inputMode="decimal" />
          </div>
          <div className="sf-field half">
            <label>Lng</label>
            <input value={form.lng} onChange={(e) => set('lng', e.target.value)} inputMode="decimal" />
          </div>
        </div>
      </div>

      <div className="vm-beers-title">{t('admin.venues.beers')}</div>
      {beers.map((b, i) => (
        <div key={i} className="vm-beer-row">
          <BrandCombobox
            value={b.brand}
            onChange={(v) => setBeer(i, 'brand', v)}
            placeholder={t('brandPicker.placeholder')}
            id={`add-venue-beer-${i}`}
            exclude={beers.filter((_, idx) => idx !== i).map((x) => x.brand).filter(Boolean)}
          />
          <BeerPriceInputs value={b} onField={(f, v) => setBeer(i, f, v)} />
          <ServeTypeSelect value={b.serve_type} onChange={(v) => setBeer(i, 'serve_type', v)} id={`add-venue-serve-${i}`} />
          {beers.length > 1 && (
            <button type="button" className="vm-remove-beer" onClick={() => removeBeerRow(i)}>✕</button>
          )}
        </div>
      ))}
      <button type="button" className="vm-add-beer-btn" onClick={addBeerRow}>+ {t('admin.venues.addAnotherBeer')}</button>

      {error && <div className="sf-error">{error}</div>}

      <div className="sf-actions">
        <button className="sf-cancel" onClick={onCancel}>{t('admin.venues.cancel')}</button>
        <button className="sf-submit" onClick={handleSubmit} disabled={saving}>
          {saving ? '...' : t('admin.venues.create')}
        </button>
      </div>
    </div>
  );
}

// The venue-level fields (name, type, neighbourhood, address, coordinates,
// hours, website, both descriptions, active toggle) — everything the beer
// price/brand editor below doesn't cover. Its own Save/Discard so editing a
// typo doesn't accidentally touch anything else.
function VenueDetailsForm({ token, venue, neighbourhoods, onUpdated }) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const [details, setDetails] = useState(() => detailsFromVenue(venue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  // If the venue changes underneath us (e.g. a beer was just added/removed) and
  // we haven't touched anything yet, keep the form's snapshot in sync.
  useEffect(() => {
    if (!dirty) setDetails(detailsFromVenue(venue));
  }, [venue, dirty]);

  const set = (k, v) => { setDetails((d) => ({ ...d, [k]: v })); setDirty(true); };

  const discard = () => {
    setDetails(detailsFromVenue(venue));
    setDirty(false);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!details.name.trim()) { setError(t('admin.venues.errName')); return; }
    setSaving(true);
    try {
      const updated = await adminUpdateVenue(token, venue.id, {
        ...details,
        name: details.name.trim(),
        lat: details.lat === '' ? null : parseFloat(details.lat),
        lng: details.lng === '' ? null : parseFloat(details.lng),
      });
      onUpdated(updated);
      setDirty(false);
      // The active toggle gets its own warning — everything else is a plain save.
      if (venue.active !== false && details.active === false) {
        showToast('warning', t('admin.toast.toggledInactive', { venue: details.name.trim() }));
      } else {
        showToast('success', t('admin.toast.venueSaved', { venue: details.name.trim() }));
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="vm-details-form">
      <div className="vm-form-grid">
        <div className="sf-field">
          <label>{t('admin.venues.name')}</label>
          <input value={details.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="sf-field">
          <label>{t('filters.type')}</label>
          <select value={details.type} onChange={(e) => set('type', e.target.value)}>
            {VENUE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`filters.types.${ty}`)}</option>)}
          </select>
        </div>
        <div className="sf-field">
          <label>{t('filters.neighbourhood')}</label>
          <select value={details.neighbourhood_id} onChange={(e) => set('neighbourhood_id', e.target.value)}>
            {neighbourhoods.map((n) => <option key={n.id} value={n.id}>{neighbourhoodName(n, i18n.language)}</option>)}
          </select>
        </div>
        <div className="sf-field">
          <label>{t('venue.address')}</label>
          <input value={details.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="sf-row">
          <div className="sf-field half">
            <label>Lat</label>
            <input value={details.lat} onChange={(e) => set('lat', e.target.value)} inputMode="decimal" />
          </div>
          <div className="sf-field half">
            <label>Lng</label>
            <input value={details.lng} onChange={(e) => set('lng', e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div className="sf-field">
          <label>{t('venue.hours')}</label>
          <input value={details.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} />
        </div>
        <div className="sf-field">
          <label>{t('admin.venues.website')}</label>
          <input value={details.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
        </div>
        <div className="sf-field vm-active-field">
          <label>{t('admin.venues.activeLabel')}</label>
          <label className="vm-active-toggle">
            <input type="checkbox" checked={details.active} onChange={(e) => set('active', e.target.checked)} />
            <span>{details.active ? t('admin.venues.active') : t('admin.venues.inactive')}</span>
          </label>
        </div>
        <div className="sf-field vm-full-width">
          <label>📝 {t('admin.venues.descDe')}</label>
          <textarea
            rows={2} value={details.description_de} onChange={(e) => set('description_de', e.target.value)}
            placeholder={t('admin.venues.descDePlaceholder')}
          />
        </div>
        <div className="sf-field vm-full-width">
          <label>📝 {t('admin.venues.descEn')}</label>
          <textarea
            rows={2} value={details.description_en} onChange={(e) => set('description_en', e.target.value)}
            placeholder={t('admin.venues.descEnPlaceholder')}
          />
        </div>
        <div className="vm-desc-warning">⚠️ {t('admin.venues.descWarning')}</div>
      </div>

      {error && <div className="sf-error">{error}</div>}

      <div className="sf-actions">
        <button className="sf-cancel" onClick={discard} disabled={!dirty || saving}>{t('admin.venues.discard')}</button>
        <button className="sf-submit" onClick={save} disabled={!dirty || saving}>
          {saving ? '...' : t('admin.venues.save')}
        </button>
      </div>
    </div>
  );
}

function EditVenueForm({ token, venue, neighbourhoods, onUpdated, onDeleted, onCancel }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [newBeer, setNewBeer] = useState(emptyBeer());
  const [addingBeer, setAddingBeer] = useState(false);
  const [deletingVenue, setDeletingVenue] = useState(false);
  // Which beers' price-history tables are open. Held here (not in each price
  // editor) because an editor is remounted after every save/verify.
  const [openHistory, setOpenHistory] = useState(() => new Set());
  const toggleHistory = (beerId) => setOpenHistory((prev) => {
    const next = new Set(prev);
    if (next.has(beerId)) next.delete(beerId); else next.add(beerId);
    return next;
  });

  const existingBrands = venue.beers.map((b) => b.brand);

  const deleteBeer = async (beer) => {
    if (!window.confirm(t('admin.venues.confirmDelete', { brand: beer.brand }))) return;
    setError('');
    setDeletingId(beer.id);
    try {
      const updated = await adminDeleteBeer(token, venue.id, beer.id);
      onUpdated(updated);
      showToast('warning', t('admin.toast.beerDeleted', { brand: beer.brand, venue: venue.name }));
    } catch (err) {
      setError(err.message);
    }
    setDeletingId(null);
  };

  const deleteVenue = async () => {
    if (!window.confirm(t('admin.venues.confirmDeleteVenue', { venue: venue.name }))) return;
    setError('');
    setDeletingVenue(true);
    try {
      await adminDeleteVenue(token, venue.id);
      showToast('warning', t('admin.toast.venueDeleted', { venue: venue.name }));
      onDeleted(venue.id);
    } catch (err) {
      setError(err.message);
      setDeletingVenue(false);
    }
  };

  const addNewBeer = async () => {
    setError('');
    const size_05 = parsePrice(newBeer.size_05);
    if (!newBeer.brand || size_05 == null) { setError(t('admin.venues.errBeer')); return; }
    setAddingBeer(true);
    try {
      const updated = await adminAddBeer(token, venue.id, {
        brand: newBeer.brand,
        size_05,
        serving_volume_ml: Number(newBeer.serving_volume_ml),
        size_mass: Number(newBeer.serving_volume_ml) === 1000 ? null : parsePrice(newBeer.size_mass),
        serve_type: newBeer.serve_type,
      });
      onUpdated(updated);
      setNewBeer(emptyBeer());
    } catch (err) {
      setError(err.message);
    }
    setAddingBeer(false);
  };

  return (
    <div className="vm-form vm-form-inline">
      <div className="vm-form-title">{t('admin.venues.editTitle')}: {venue.name}</div>

      <VenueDetailsForm token={token} venue={venue} neighbourhoods={neighbourhoods} onUpdated={onUpdated} />

      <div className="vm-beers-title">{t('admin.venues.beers')}</div>
      {venue.beers.map((b) => (
        <BeerPriceEditor
          // Remount whenever the SAVED beer changes, so the form always starts
          // from what is stored; unsaved edits survive everything else.
          key={[b.id, b.size_05, b.size_mass, b.serving_volume_ml, b.serve_type, b.price_observed_at, b.verified_at, b.source_type, b.notes, b.updated].join('|')}
          token={token}
          venue={venue}
          beer={b}
          onUpdated={onUpdated}
          onDelete={() => deleteBeer(b)}
          deleting={deletingId === b.id}
          canDelete={venue.beers.length > 1}
          historyOpen={openHistory.has(b.id)}
          onToggleHistory={() => toggleHistory(b.id)}
        />
      ))}

      <div className="vm-beers-title">{t('admin.venues.addAnotherBeer')}</div>
      <div className="vm-beer-row">
        <BrandCombobox
          value={newBeer.brand}
          onChange={(v) => setNewBeer((b) => ({ ...b, brand: v }))}
          placeholder={t('brandPicker.placeholder')}
          id={`edit-venue-new-beer-${venue.id}`}
          exclude={existingBrands}
        />
        <BeerPriceInputs value={newBeer} onField={(f, v) => setNewBeer((b) => ({ ...b, [f]: v }))} />
        <ServeTypeSelect
          value={newBeer.serve_type}
          onChange={(v) => setNewBeer((b) => ({ ...b, serve_type: v }))}
          id={`edit-venue-new-beer-serve-${venue.id}`}
        />
        <button type="button" className="vm-save-beer" onClick={addNewBeer} disabled={addingBeer}>
          {addingBeer ? '...' : '+'}
        </button>
      </div>

      {error && <div className="sf-error">{error}</div>}

      <div className="sf-actions">
        <button className="vm-delete-venue" onClick={deleteVenue} disabled={deletingVenue}>
          {deletingVenue ? '...' : `🗑 ${t('admin.venues.deleteVenue')}`}
        </button>
        <button className="sf-cancel" onClick={onCancel}>{t('admin.venues.close')}</button>
      </div>
    </div>
  );
}

export default function VenueManager({ token, initialQuery = '', initialEditVenueId = null }) {
  const { t, i18n } = useTranslation();
  const [venues, setVenues] = useState([]);
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  // Seeded from the Data Quality tab's "Edit" — opens that venue's editor as soon as the list loads.
  const [editingVenueId, setEditingVenueId] = useState(initialEditVenueId);
  // Seeded from the Activity Log's "jump to this venue" link — VenueManager is
  // only ever mounted while section==='venues', so a fresh initialQuery always
  // reaches a fresh instance of this state.
  const [query, setQuery] = useState(initialQuery);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adminFetchVenues(token), fetchNeighbourhoods()])
      .then(([v, n]) => { setVenues(v); setNeighbourhoods(n); })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = () => { setShowAdd(false); load(); };
  const handleUpdated = (updatedVenue) => {
    setVenues((vs) => vs.map((v) => (v.id === updatedVenue.id ? updatedVenue : v)));
  };
  const handleDeleted = (venueId) => {
    setVenues((vs) => vs.filter((v) => v.id !== venueId));
    setEditingVenueId((id) => (id === venueId ? null : id));
  };

  // Real-time filter. One box finds a venue by name, address, neighbourhood
  // (id or either language), beer brand, serving size ("0.33L", "330ml"…) or
  // data-quality flag ("stale", "duplicate"…) — see utils/adminSearch.js.
  const filteredVenues = useMemo(() => {
    if (!query.trim()) return venues;
    const hoodNames = {};
    neighbourhoods.forEach((n) => { hoodNames[n.id] = `${n.name_de} ${n.name_en}`; });
    return venues.filter((v) => venueMatchesQuery(v, query, hoodNames));
  }, [venues, neighbourhoods, query]);

  const editingVenue = editingVenueId ? venues.find((v) => v.id === editingVenueId) : null;

  return (
    <div className="venue-manager">
      <div className="vm-header">
        <div className="vm-count">{t('admin.venues.total', { count: filteredVenues.length })}</div>
        <button className="vm-add-btn" onClick={() => setShowAdd(true)}>+ {t('admin.venues.addTitle')}</button>
      </div>

      <div className="vm-search-wrap">
        <input
          className="vm-search"
          type="text"
          placeholder={t('admin.venues.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
      </div>

      {showAdd && (
        <AddVenueForm token={token} neighbourhoods={neighbourhoods} onCreated={handleCreated} onCancel={() => setShowAdd(false)} />
      )}

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : (
        <div className="vm-table-wrap">
          <table className="vm-table">
            <thead>
              <tr>
                <th>{t('admin.venues.name')}</th>
                <th>{t('filters.neighbourhood')}</th>
                <th>{t('admin.venues.beers')}</th>
                <th>{t('admin.venues.cheapest')}</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredVenues.map((v) => (
                <Fragment key={v.id}>
                  <tr className={v.active === false ? 'vm-row-inactive' : ''}>
                    <td>{v.name}</td>
                    <td>
                      {i18n.language === 'de' ? v.neighbourhood_name_de : v.neighbourhood_name_en}
                      {v.outside_modelled_area && (
                        <span className="vm-approx-badge" title={t('admin.venues.outsideModelledAreaHint')}>
                          {t('admin.venues.outsideModelledArea')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="vm-tags">
                        {v.beers.map((b) => <span key={b.id} className="vm-tag">{b.brand}</span>)}
                      </div>
                    </td>
                    <td>
                      {/* The same price/size/freshness the public card shows, from the same helpers */}
                      {v.beers[0] ? (
                        <span className="vm-price-cell">
                          {formatEuro(v.beers[0].size_05, i18n.language)}
                          <small className="vm-price-size">{formatVolume(v.beers[0].serving_volume_ml, i18n.language) || t('price.sizeUnknown')}</small>
                          <FreshnessLight beer={v.beers[0]} compact />
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {v.active === false && <span className="vm-inactive-badge">{t('admin.venues.inactive')}</span>}
                      {/* Open data-quality flags — text badges (never colour alone); click one to filter the list by it */}
                      {(v.flags || []).length > 0 && (
                        <div className="vm-flags">
                          {[...new Set(v.flags.map((f) => f.flag))].slice(0, 3).map((code) => (
                            <button
                              key={code} type="button" className={`dq-badge dq-badge-sm dq-badge-${flagSeverity(code)}`}
                              onClick={() => setQuery(code.toLowerCase().replace(/_/g, ' '))}
                              title={t(`admin.quality.desc.${code}`, '')}
                            >
                              {t(`admin.quality.flags.${code}`, code)}
                            </button>
                          ))}
                          {new Set(v.flags.map((f) => f.flag)).size > 3 && (
                            <span className="dq-more-n">+{new Set(v.flags.map((f) => f.flag)).size - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="vm-edit-btn"
                        onClick={() => setEditingVenueId((id) => (id === v.id ? null : v.id))}
                      >
                        {editingVenueId === v.id ? t('admin.venues.close') : t('admin.venues.edit')}
                      </button>
                    </td>
                  </tr>
                  {editingVenueId === v.id && editingVenue && (
                    <tr className="vm-edit-tr">
                      <td colSpan={6}>
                        <EditVenueForm
                          token={token}
                          venue={editingVenue}
                          neighbourhoods={neighbourhoods}
                          onUpdated={handleUpdated}
                          onDeleted={handleDeleted}
                          onCancel={() => setEditingVenueId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filteredVenues.length === 0 && (
                <tr><td colSpan={6} className="vm-no-results">{t('search.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
