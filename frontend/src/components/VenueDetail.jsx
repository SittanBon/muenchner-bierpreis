import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchVenue } from '../hooks/useApi';
import ReportForm from './ReportForm';
import FreshnessLight from './FreshnessLight';
import ServeTypeTag from './ServeTypeTag';
import VenueTypeIcon from './VenueTypeIcon';
import PriceSecondary from './PriceSecondary';
import { formatEuro } from '../utils/price';
import { describePrice } from '../utils/priceUtils';

// recharts is heavy — the chart loads on demand (see BrandHistoryChart.jsx).
const BrandHistoryChart = lazy(() => import('./BrandHistoryChart'));

export default function VenueDetail({ venue: initialVenue, onBack }) {
  const { t, i18n } = useTranslation();
  const [venue, setVenue] = useState(initialVenue);
  const [showReport, setShowReport] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchVenue(initialVenue.id)
      .then(data => { setVenue(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [initialVenue.id]);

  const beers = venue.beers || [];
  const headline = beers[0]; // cheapest per 0.5 L — the API sorts beers by the normalized price
  const otherBeers = beers.slice(1);
  const headlinePrice = headline ? describePrice(headline, i18n.language) : null;
  // The price chart compares like with like: each historical price at its
  // per-0.5 L equivalent, and a report whose size isn't a known one is left out.
  const comparableHistory = useMemo(() => (venue.price_history || [])
    .filter((h) => h.normalized_500ml_price != null)
    .map((h) => ({ ...h, price: h.normalized_500ml_price })), [venue.price_history]);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name + ' ' + venue.address)}`;

  const handleSubmitSuccess = () => {
    setShowReport(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
  };

  return (
    <div className="venue-detail">
      {/* Back button */}
      <button className="back-btn" onClick={onBack}>← {t('backToMap')}</button>

      {/* Hero */}
      <div className="vd-hero">
        <div className="vd-icon-big"><VenueTypeIcon type={venue.type} size={40} /></div>
        <div className="vd-hero-info">
          {/* h2, not h1 — this view is rendered inline under the app's own
              site-title h1 (brief Section 14 calls for one h1 per page). */}
          <h2 className="vd-name">{venue.name}</h2>
          <div className="vd-meta">
            <span className="vd-type-badge">{t(`filters.types.${venue.type}`)}</span>
            <span className="vd-neighbourhood">
              {i18n.language === 'de' ? venue.neighbourhood_name_de : venue.neighbourhood_name_en}
            </span>
          </div>
        </div>
      </div>

      {/* Headline price block — always the cheapest active beer */}
      {headline && (
        <div className="vd-price-block">
          <div className="vdp-main">
            <div className="vdp-amount">{headlinePrice.actual}</div>
            <div className="vdp-label">
              {headlinePrice.sizeUnknown ? t('price.sizeUnknown') : t('price.forSize', { size: headlinePrice.volumeLabel })}
            </div>
            {/* Secondary, muted: only when the size is known and isn't 0.5 L already */}
            {headlinePrice.normalized && (
              <div className="vdp-normalized">{t('price.approxPer05', { price: headlinePrice.normalized })}</div>
            )}
          </div>
          {headline.size_mass && (
            <div className="vdp-mass">
              <div className="vdp-amount-sm">{formatEuro(headline.size_mass, i18n.language)}</div>
              <div className="vdp-label">{t('venue.priceMass')}</div>
            </div>
          )}
          <div className="vdp-brand-block">
            <div className="vdp-brand">🍻 {headline.brand}</div>
            <div className="vdp-serve-type"><ServeTypeTag serveType={headline.serve_type} /></div>
            <div className="vdp-freshness">
              <FreshnessLight beer={headline} />
            </div>
          </div>
        </div>
      )}

      {/* Unified report entry point — moved right below the price block so
          it's the first thing offered after seeing the price, not something
          you have to scroll past everything else to find. */}
      {showReport ? (
        <ReportForm
          venueId={venue.id}
          venueName={venue.name}
          onSuccess={handleSubmitSuccess}
          onCancel={() => setShowReport(false)}
        />
      ) : (
        <button className="vd-report-btn" onClick={() => setShowReport(true)}>
          📢 {t('report.button')}
        </button>
      )}

      {/* Other beers at this venue */}
      {otherBeers.length > 0 && (
        <div className="vd-other-beers">
          <div className="section-title">{t('venue.otherBeers')}</div>
          {otherBeers.map((b) => (
            <div key={b.id} className="ob-row">
              <div className="ob-info">
                <span className="ob-brand">🍺 {b.brand}</span>
                <ServeTypeTag serveType={b.serve_type} />
                <FreshnessLight beer={b} compact />
              </div>
              <span className="ob-price-wrap">
                <span className="ob-price">{formatEuro(b.size_05, i18n.language)}</span>
                <PriceSecondary beer={b} />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* About this place — hidden entirely when neither language has one */}
      {(venue.description_de || venue.description_en) && (
        <div className="vd-about">
          <div className="vd-about-label">ℹ️ {t('venue.aboutLabel')}</div>
          <p className="vd-description">
            {(i18n.language === 'de' ? venue.description_de : venue.description_en) || venue.description_de || venue.description_en}
          </p>
        </div>
      )}

      {/* Info grid. Address is hidden when missing (nothing useful to say);
          opening hours instead shows a small muted-italic "unknown" line
          rather than disappearing — a venue with no hours on file is still
          worth knowing that about, distinct from a field that's simply N/A.
          Website has no display anywhere on this page by design (hidden
          completely when absent, same as description below), so there's no
          markup here to gate on it at all. */}
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
        <div className="vd-info-item">
          <span className="vd-info-icon">🕐</span>
          <div>
            <div className="vd-info-label">{t('venue.hours')}</div>
            {venue.opening_hours ? (
              <div className="vd-info-value">{venue.opening_hours}</div>
            ) : (
              <div className="vd-info-value vd-info-unknown">{t('venue.hoursUnknown')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="vd-actions">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="action-btn directions">
          🗺️ {t('venue.directions')}
        </a>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="submit-success">{t('submission.success')}</div>
      )}

      {/* Price history — separate coloured line per brand + days-at-price */}
      {!loading && (
        <div className="price-history">
          <div className="section-title">{t('priceHistory')}</div>
          <Suspense fallback={<div className="skeleton-line" style={{ height: 220 }} role="status" aria-label={t('loading')} />}>
            <BrandHistoryChart history={comparableHistory} beers={beers} />
          </Suspense>
        </div>
      )}

      {/* Disclaimer */}
      <p className="vd-disclaimer">{t('venue.disclaimer')}</p>
    </div>
  );
}
