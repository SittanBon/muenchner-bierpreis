import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchVenue } from '../hooks/useApi';
import SubmissionForm from './SubmissionForm';
import FreshnessLight from './FreshnessLight';

const TYPE_ICONS = { beer_garden: '🌳', beer_hall: '🏛️', bar: '🍺', restaurant: '🍽️' };

function PriceHistory({ history }) {
  const { t } = useTranslation();
  if (!history?.length) return null;

  const max = Math.max(...history.map(h => h.price));
  const min = Math.min(...history.map(h => h.price));

  return (
    <div className="price-history">
      <div className="section-title">{t('priceHistory')}</div>
      <div className="history-list">
        {history.slice(0, 6).map((h, i) => (
          <div key={i} className="history-item">
            <span className="hi-date">{new Date(h.visit_date).toLocaleDateString()}</span>
            <div className="hi-bar-wrap">
              <div className="hi-bar" style={{ width: `${((h.price - min + 0.5) / (max - min + 1)) * 100}%` }} />
            </div>
            <span className="hi-price">€{h.price.toFixed(2)}</span>
            <span className="hi-who">{h.submitter_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VenueDetail({ venue: initialVenue, onBack }) {
  const { t, i18n } = useTranslation();
  const [venue, setVenue] = useState(initialVenue);
  const [showForm, setShowForm] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchVenue(initialVenue.id)
      .then(data => { setVenue(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [initialVenue.id]);

  const beer = venue.beers?.[0];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name + ' ' + venue.address)}`;

  const handleSubmitSuccess = () => {
    setShowForm(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
  };

  return (
    <div className="venue-detail">
      {/* Back button */}
      <button className="back-btn" onClick={onBack}>← {t('backToMap')}</button>

      {/* Hero */}
      <div className="vd-hero">
        <div className="vd-icon-big">{TYPE_ICONS[venue.type] || '🍺'}</div>
        <div className="vd-hero-info">
          <h1 className="vd-name">{venue.name}</h1>
          <div className="vd-meta">
            <span className="vd-type-badge">{t(`filters.types.${venue.type}`)}</span>
            <span className="vd-neighbourhood">
              {i18n.language === 'de' ? venue.neighbourhood_name_de : venue.neighbourhood_name_en}
            </span>
          </div>
        </div>
      </div>

      {/* Price block */}
      {beer && (
        <div className="vd-price-block">
          <div className="vdp-main">
            <div className="vdp-amount">€{beer.size_05.toFixed(2)}</div>
            <div className="vdp-label">{t('venue.price05')}</div>
          </div>
          {beer.size_mass && (
            <div className="vdp-mass">
              <div className="vdp-amount-sm">€{beer.size_mass.toFixed(2)}</div>
              <div className="vdp-label">{t('venue.priceMass')}</div>
            </div>
          )}
          <div className="vdp-brand-block">
            <div className="vdp-brand">🍻 {beer.brand}</div>
            <div className="vdp-updated">
              {t('venue.lastUpdated')}: {new Date(beer.updated).toLocaleDateString()}
            </div>
            <div className="vdp-freshness">
              <FreshnessLight date={beer.updated} />
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {(venue.description_de || venue.description_en) && (
        <p className="vd-description">
          {i18n.language === 'de' ? venue.description_de : venue.description_en}
        </p>
      )}

      {/* Info grid */}
      <div className="vd-info-grid">
        {venue.address && (
          <div className="vd-info-item">
            <span className="vd-info-icon">📍</span>
            <div>
              <div className="vd-info-label">{t('venue.address')}</div>
              <div className="vd-info-value">{venue.address}</div>
            </div>
          </div>
        )}
        {venue.opening_hours && (
          <div className="vd-info-item">
            <span className="vd-info-icon">🕐</span>
            <div>
              <div className="vd-info-label">{t('venue.hours')}</div>
              <div className="vd-info-value">{venue.opening_hours}</div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="vd-actions">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="action-btn directions">
          🗺️ {t('venue.directions')}
        </a>
        <button className="action-btn report" onClick={() => setShowForm(!showForm)}>
          💬 {t('venue.reportPrice')}
        </button>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="submit-success">{t('submission.success')}</div>
      )}

      {/* Submission form */}
      {showForm && (
        <SubmissionForm
          venueId={venue.id}
          venueName={venue.name}
          currentBrand={beer?.brand}
          onSuccess={handleSubmitSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Price history */}
      {!loading && <PriceHistory history={venue.price_history} />}

      {/* Report incorrect info */}
      <div className="vd-report-link">
        <button className="report-incorrect-btn">{t('venue.reportIncorrect')}</button>
      </div>
    </div>
  );
}
