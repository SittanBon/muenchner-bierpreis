import { useState, useEffect, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { adminFetchCities, adminCreateCity, adminUpdateCity } from '../hooks/useApi';

function emptyForm() {
  return { name: '', name_en: '', country_code: '', lat: '', lng: '', zoom_level: '13' };
}

function formFromCity(city) {
  return {
    name: city.name,
    name_en: city.name_en,
    country_code: city.country_code,
    lat: String(city.lat),
    lng: String(city.lng),
    zoom_level: String(city.zoom_level),
  };
}

// Shared fields for both the "add" and "edit" forms — name/name_en/country
// code/coordinates/zoom. The active/coming-soon toggles live on the table row
// itself (like the venue active toggle), not in this form.
function CityFields({ form, set }) {
  const { t } = useTranslation();
  return (
    <div className="vm-form-grid">
      <div className="sf-field">
        <label>{t('admin.cities.name')}</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="sf-field">
        <label>{t('admin.cities.nameEn')}</label>
        <input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
      </div>
      <div className="sf-field">
        <label>{t('admin.cities.countryCode')}</label>
        <input
          value={form.country_code}
          onChange={(e) => set('country_code', e.target.value.toUpperCase())}
          maxLength={2}
          placeholder="DE"
        />
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
      <div className="sf-field">
        <label>{t('admin.cities.zoomLevel')}</label>
        <input value={form.zoom_level} onChange={(e) => set('zoom_level', e.target.value)} inputMode="numeric" />
      </div>
    </div>
  );
}

function validate(form, t) {
  if (!form.name.trim() || !form.name_en.trim() || !form.country_code.trim()) {
    return t('admin.cities.errName');
  }
  if (Number.isNaN(parseFloat(form.lat)) || Number.isNaN(parseFloat(form.lng))) {
    return t('admin.cities.errCoords');
  }
  return '';
}

function AddCityForm({ token, onCreated, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const err = validate(form, t);
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      await adminCreateCity(token, {
        name: form.name.trim(),
        name_en: form.name_en.trim(),
        country_code: form.country_code.trim(),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        zoom_level: form.zoom_level ? parseInt(form.zoom_level, 10) : 13,
        // A freshly added city has nothing on the map yet — start it as a
        // coming-soon preview; flip it live from the table once it's ready.
        is_active: false,
        coming_soon: true,
      });
      onCreated();
    } catch (err2) {
      setError(err2.message);
    }
    setSaving(false);
  };

  return (
    <div className="vm-form">
      <div className="vm-form-title">{t('admin.cities.addTitle')}</div>
      <CityFields form={form} set={set} />
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

function EditCityForm({ token, city, onUpdated, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => formFromCity(city));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const err = validate(form, t);
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const updated = await adminUpdateCity(token, city.id, {
        name: form.name.trim(),
        name_en: form.name_en.trim(),
        country_code: form.country_code.trim(),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        zoom_level: form.zoom_level ? parseInt(form.zoom_level, 10) : 13,
        // This form never touches the toggles — carry the row's current values through.
        is_active: city.is_active,
        coming_soon: city.coming_soon,
      });
      onUpdated(updated);
      onCancel();
    } catch (err2) {
      setError(err2.message);
    }
    setSaving(false);
  };

  return (
    <div className="vm-form vm-form-inline">
      <div className="vm-form-title">{t('admin.cities.editTitle')}: {city.name}</div>
      <CityFields form={form} set={set} />
      {error && <div className="sf-error">{error}</div>}
      <div className="sf-actions">
        <button className="sf-cancel" onClick={onCancel}>{t('admin.venues.close')}</button>
        <button className="sf-submit" onClick={save} disabled={saving}>
          {saving ? '...' : t('admin.venues.save')}
        </button>
      </div>
    </div>
  );
}

export default function CityManager({ token }) {
  const { t } = useTranslation();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminFetchCities(token).then(setCities).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = () => { setShowAdd(false); load(); };
  const handleUpdated = (updated) => {
    setCities((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Active/coming-soon toggles PATCH immediately (like the venue active
  // toggle) — no separate save step, since flipping a switch is the whole action.
  const toggleField = async (city, field) => {
    setError('');
    try {
      const updated = await adminUpdateCity(token, city.id, { ...city, [field]: !city[field] });
      handleUpdated(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const editingCity = editingId ? cities.find((c) => c.id === editingId) : null;

  return (
    <div className="venue-manager">
      <div className="vm-header">
        <div className="vm-count">{t('admin.cities.total', { count: cities.length })}</div>
        <button className="vm-add-btn" onClick={() => setShowAdd(true)}>+ {t('admin.cities.addTitle')}</button>
      </div>

      {error && <div className="sf-error">{error}</div>}

      {showAdd && (
        <AddCityForm token={token} onCreated={handleCreated} onCancel={() => setShowAdd(false)} />
      )}

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : (
        <div className="vm-table-wrap">
          <table className="vm-table">
            <thead>
              <tr>
                <th>{t('admin.cities.name')}</th>
                <th>{t('admin.cities.countryCode')}</th>
                <th>{t('map.venues')}</th>
                <th>{t('admin.venues.activeLabel')}</th>
                <th>{t('admin.cities.comingSoon')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <Fragment key={c.id}>
                  <tr className={!c.is_active ? 'vm-row-inactive' : ''}>
                    <td>{c.name} <span className="cm-name-en">({c.name_en})</span></td>
                    <td>{c.country_code}</td>
                    <td>{c.venue_count}</td>
                    <td>
                      <label className="vm-active-toggle">
                        <input type="checkbox" checked={c.is_active} onChange={() => toggleField(c, 'is_active')} />
                        <span>{c.is_active ? t('admin.venues.active') : t('admin.venues.inactive')}</span>
                      </label>
                    </td>
                    <td>
                      <label className="vm-active-toggle">
                        <input type="checkbox" checked={c.coming_soon} onChange={() => toggleField(c, 'coming_soon')} />
                        <span>{c.coming_soon ? t('admin.cities.comingSoon') : '—'}</span>
                      </label>
                    </td>
                    <td>
                      <button
                        className="vm-edit-btn"
                        onClick={() => setEditingId((id) => (id === c.id ? null : c.id))}
                      >
                        {editingId === c.id ? t('admin.venues.close') : t('admin.venues.edit')}
                      </button>
                    </td>
                  </tr>
                  {editingId === c.id && editingCity && (
                    <tr className="vm-edit-tr">
                      <td colSpan={6}>
                        <EditCityForm
                          token={token}
                          city={editingCity}
                          onUpdated={handleUpdated}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {cities.length === 0 && (
                <tr><td colSpan={6} className="vm-no-results">{t('search.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
