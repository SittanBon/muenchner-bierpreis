import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitPrice } from '../hooks/useApi';

const BRANDS = ['Augustiner', 'Paulaner', 'Hofbräu', 'Hacker-Pschorr', 'Löwenbräu', 'Spaten', 'Andechs', 'Ayinger', 'Haderner', 'Andere'];

export default function SubmissionForm({ venueId, venueName, currentBrand, isNewVenue, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    beer_brand: currentBrand || '',
    size: '0.5L',
    price: '',
    visit_date: new Date().toISOString().split('T')[0],
    submitter_name: '',
    anonymous: false,
    note: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.price || !form.beer_brand) {
      setError('Preis und Biermarke sind erforderlich / Price and brand required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await submitPrice({
        venue_id: venueId,
        venue_name: venueName,
        is_new_venue: !!isNewVenue,
        beer_brand: form.beer_brand,
        size: form.size,
        price: parseFloat(form.price.replace(',', '.')),
        visit_date: form.visit_date,
        submitter_name: form.anonymous ? 'Anonym' : form.submitter_name,
        note: form.note
      });
      onSuccess();
    } catch {
      setError(t('submission.error'));
    }
    setLoading(false);
  };

  return (
    <div className="submission-form">
      <div className="sf-title">{t('submission.title')}</div>
      {venueName && <div className="sf-venue">{venueName}</div>}

      <div className="sf-field">
        <label>{t('submission.brand')}</label>
        <select value={form.beer_brand} onChange={e => set('beer_brand', e.target.value)}>
          <option value="">-- Auswählen --</option>
          {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="sf-row">
        <div className="sf-field half">
          <label>{t('submission.size')}</label>
          <select value={form.size} onChange={e => set('size', e.target.value)}>
            <option value="0.5L">0,5L (Halbe)</option>
            <option value="1L">1L (Maß)</option>
          </select>
        </div>
        <div className="sf-field half">
          <label>{t('submission.price')}</label>
          <input
            type="text"
            placeholder={t('submission.pricePlaceholder')}
            value={form.price}
            onChange={e => set('price', e.target.value)}
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="sf-field">
        <label>{t('submission.date')}</label>
        <input type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} max={new Date().toISOString().split('T')[0]} />
      </div>

      <div className="sf-field">
        <label>{t('submission.name')}</label>
        <div className="sf-name-row">
          <input
            type="text"
            placeholder={t('submission.namePlaceholder')}
            value={form.submitter_name}
            onChange={e => set('submitter_name', e.target.value)}
            disabled={form.anonymous}
            style={{ flex: 1 }}
          />
          <label className="anon-toggle">
            <input type="checkbox" checked={form.anonymous} onChange={e => set('anonymous', e.target.checked)} />
            <span>{t('submission.anonymous')}</span>
          </label>
        </div>
      </div>

      {error && <div className="sf-error">{error}</div>}

      <div className="sf-actions">
        <button className="sf-cancel" onClick={onCancel}>Abbrechen</button>
        <button className="sf-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : t('submission.submit')}
        </button>
      </div>
    </div>
  );
}
