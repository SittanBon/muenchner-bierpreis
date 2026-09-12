import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchVenues, fetchNeighbourhoods, adminCreateVenue, adminAddBeer, adminUpdateBeerPrice, adminDeleteBeer } from '../hooks/useApi';
import { BRANDS } from '../constants/brands';

const TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];

function emptyBeer() { return { brand: '', size_05: '', size_mass: '' }; }

function AddVenueForm({ token, neighbourhoods, onCreated, onCancel }) {
  const { t } = useTranslation();
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
    const cleanBeers = beers.filter((b) => b.brand && b.size_05);
    if (cleanBeers.length === 0) {
      setError(t('admin.venues.errBeer'));
      return;
    }
    setSaving(true);
    try {
      await adminCreateVenue(token, {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        beers: cleanBeers.map((b) => ({
          brand: b.brand, size_05: parseFloat(b.size_05),
          size_mass: b.size_mass ? parseFloat(b.size_mass) : null,
        })),
      });
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
            {TYPES.map((ty) => <option key={ty} value={ty}>{t(`filters.types.${ty}`)}</option>)}
          </select>
        </div>
        <div className="sf-field">
          <label>{t('filters.neighbourhood')}</label>
          <select value={form.neighbourhood_id} onChange={(e) => set('neighbourhood_id', e.target.value)}>
            {neighbourhoods.map((n) => <option key={n.id} value={n.id}>{n.name_de}</option>)}
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
          <select value={b.brand} onChange={(e) => setBeer(i, 'brand', e.target.value)}>
            <option value="">-- {t('submission.brand')} --</option>
            {BRANDS.map((br) => <option key={br} value={br}>{br}</option>)}
          </select>
          <input
            className="vm-price-input" placeholder="0,5L €" inputMode="decimal"
            value={b.size_05} onChange={(e) => setBeer(i, 'size_05', e.target.value)}
          />
          <input
            className="vm-price-input" placeholder="1L €" inputMode="decimal"
            value={b.size_mass} onChange={(e) => setBeer(i, 'size_mass', e.target.value)}
          />
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

function EditVenueForm({ token, venue, onUpdated, onCancel }) {
  const { t } = useTranslation();
  const [prices, setPrices] = useState(() => Object.fromEntries(venue.beers.map((b) => [b.id, String(b.size_05)])));
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [newBeer, setNewBeer] = useState(emptyBeer());
  const [addingBeer, setAddingBeer] = useState(false);

  // Prices are keyed by beer id, so a fresh venue prop (after any edit) just
  // adds/keeps entries — no need to reset the whole map each time.
  useEffect(() => {
    setPrices((p) => {
      const next = { ...p };
      venue.beers.forEach((b) => { if (!(b.id in next)) next[b.id] = String(b.size_05); });
      return next;
    });
  }, [venue.beers]);

  const existingBrands = venue.beers.map((b) => b.brand);
  const availableBrands = BRANDS.filter((b) => !existingBrands.includes(b));

  const savePrice = async (beer) => {
    setError('');
    const size_05 = parseFloat(prices[beer.id]);
    if (Number.isNaN(size_05)) { setError(t('admin.venues.errPrice')); return; }
    setSavingId(beer.id);
    try {
      const updated = await adminUpdateBeerPrice(token, venue.id, beer.id, { size_05, size_mass: beer.size_mass });
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    }
    setSavingId(null);
  };

  const deleteBeer = async (beer) => {
    if (!window.confirm(t('admin.venues.confirmDelete', { brand: beer.brand }))) return;
    setError('');
    setDeletingId(beer.id);
    try {
      const updated = await adminDeleteBeer(token, venue.id, beer.id);
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    }
    setDeletingId(null);
  };

  const addNewBeer = async () => {
    setError('');
    if (!newBeer.brand || !newBeer.size_05) { setError(t('admin.venues.errBeer')); return; }
    setAddingBeer(true);
    try {
      const updated = await adminAddBeer(token, venue.id, {
        brand: newBeer.brand,
        size_05: parseFloat(newBeer.size_05),
        size_mass: newBeer.size_mass ? parseFloat(newBeer.size_mass) : null,
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

      <div className="vm-beers-title">{t('admin.venues.beers')}</div>
      {venue.beers.map((b) => (
        <div key={b.id} className="vm-beer-row vm-edit-row">
          <span className="vm-beer-brand">{b.brand}</span>
          <input
            className="vm-price-input" inputMode="decimal"
            value={prices[b.id] ?? ''}
            onChange={(e) => setPrices((p) => ({ ...p, [b.id]: e.target.value }))}
          />
          <button type="button" className="vm-save-beer" onClick={() => savePrice(b)} disabled={savingId === b.id}>
            {savingId === b.id ? '...' : t('admin.venues.save')}
          </button>
          <button
            type="button" className="vm-delete-beer"
            onClick={() => deleteBeer(b)} disabled={deletingId === b.id || venue.beers.length <= 1}
            title={venue.beers.length <= 1 ? t('admin.venues.lastBeer') : t('admin.venues.deleteBeer')}
          >
            {deletingId === b.id ? '...' : `🗑 ${t('admin.venues.deleteBeer')}`}
          </button>
        </div>
      ))}

      <div className="vm-beers-title">{t('admin.venues.addAnotherBeer')}</div>
      <div className="vm-beer-row">
        <select value={newBeer.brand} onChange={(e) => setNewBeer((b) => ({ ...b, brand: e.target.value }))}>
          <option value="">-- {t('submission.brand')} --</option>
          {availableBrands.map((br) => <option key={br} value={br}>{br}</option>)}
        </select>
        <input
          className="vm-price-input" placeholder="0,5L €" inputMode="decimal"
          value={newBeer.size_05} onChange={(e) => setNewBeer((b) => ({ ...b, size_05: e.target.value }))}
        />
        <input
          className="vm-price-input" placeholder="1L €" inputMode="decimal"
          value={newBeer.size_mass} onChange={(e) => setNewBeer((b) => ({ ...b, size_mass: e.target.value }))}
        />
        <button type="button" className="vm-save-beer" onClick={addNewBeer} disabled={addingBeer}>
          {addingBeer ? '...' : '+'}
        </button>
      </div>

      {error && <div className="sf-error">{error}</div>}

      <div className="sf-actions">
        <button className="sf-cancel" onClick={onCancel}>{t('admin.venues.close')}</button>
      </div>
    </div>
  );
}

export default function VenueManager({ token }) {
  const { t } = useTranslation();
  const [venues, setVenues] = useState([]);
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchVenues(), fetchNeighbourhoods()])
      .then(([v, n]) => { setVenues(v); setNeighbourhoods(n); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = () => { setShowAdd(false); load(); };
  const handleUpdated = (updatedVenue) => {
    setVenues((vs) => vs.map((v) => (v.id === updatedVenue.id ? updatedVenue : v)));
  };

  // Real-time filter by name, neighbourhood (id or either-language name) or brand.
  const filteredVenues = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues;
    const hoodNames = {};
    neighbourhoods.forEach((n) => { hoodNames[n.id] = `${n.name_de} ${n.name_en}`.toLowerCase(); });
    return venues.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      (hoodNames[v.neighbourhood_id] || v.neighbourhood_id).includes(q) ||
      v.beers.some((b) => b.brand.toLowerCase().includes(q))
    );
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
              </tr>
            </thead>
            <tbody>
              {filteredVenues.map((v) => (
                <Fragment key={v.id}>
                  <tr>
                    <td>{v.name}</td>
                    <td>{v.neighbourhood_name_de}</td>
                    <td>
                      <div className="vm-tags">
                        {v.beers.map((b) => <span key={b.id} className="vm-tag">{b.brand}</span>)}
                      </div>
                    </td>
                    <td>€{v.beers[0]?.size_05?.toFixed(2) ?? '—'}</td>
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
                      <td colSpan={5}>
                        <EditVenueForm
                          token={token}
                          venue={editingVenue}
                          onUpdated={handleUpdated}
                          onCancel={() => setEditingVenueId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filteredVenues.length === 0 && (
                <tr><td colSpan={5} className="vm-no-results">{t('search.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
