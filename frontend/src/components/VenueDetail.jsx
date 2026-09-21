import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchVenue } from '../hooks/useApi';
import ReportForm from './ReportForm';
import FreshnessLight from './FreshnessLight';
import ServeTypeTag from './ServeTypeTag';
import VenueTypeIcon from './VenueTypeIcon';
import { formatEuro } from '../utils/price';
import { describePrice } from '../utils/priceUtils';
import { sizeLine, distanceText, hoursText, knownServeType, mapsLinks } from '../utils/venueView';

// recharts is heavy — the chart loads on demand (see BrandHistoryChart.jsx).
const BrandHistoryChart = lazy(() => import('./BrandHistoryChart'));

// One serving size line: "0,50L · Halbe" — or, when the size is not known, the muted
// "Größe unbekannt". 0.5 L is never assumed.
function SizeLine({ beer, className = '' }) {
  const { t, i18n } = useTranslation();
  const line = sizeLine(beer, i18n.language);
  return line
    ? <span className={className}>{line}</span>
    : <span className={`price-size-unknown ${className}`}>{t('price.sizeUnknown')}</span>;
}

// A venue's details — the same content in the mobile bottom sheet (full width) and the
// desktop left panel. Order: name, type + area · price block (actual price, size,
// per-0.5 L comparison, freshness, brand + serve type) · distance, opening hours,
// address · directions + reviews · other beers · price history · report button.
// Anything we do not actually know (distance, hours, serve type) is left out — never
// replaced by a placeholder claim.
export default function VenueDetail({ venue: initialVenue, onBack, userLocation = null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [venue, setVenue] = useState(initialVenue);
  const [showReport, setShowReport] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetchVenue(initialVenue.id)
      .then(data => { setVenue(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [initialVenue.id]);

  const beers = venue.beers || [];
  const headline = beers[0]; // cheapest per 0.5 L — the API sorts beers by the normalized price
  const otherBeers = beers.slice(1);
  const headlinePrice = headline ? describePrice(headline, lang) : null;
  const headlineServe = headline ? knownServeType(headline) : null;
  // The price chart compares like with like: each historical price at its
  // per-0.5 L equivalent, and a report whose size isn't a known one is left out.
  const comparableHistory = useMemo(() => (venue.price_history || [])
    .filter((h) => h.normalized_500ml_price != null)
    .map((h) => ({ ...h, price: h.normalized_500ml_price })), [venue.price_history]);
  const links = mapsLinks(venue);
  const distance = distanceText(userLocation, venue, lang);
  const hours = hoursText(venue);
  const area = lang === 'de' ? venue.neighbourhood_name_de : venue.neighbourhood_name_en;

  const handleSubmitSuccess = () => {
    setShowReport(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
  };
  const openReport = () => {
    setShowReport(true);
    // The button lives at the bottom of a long scrolling sheet — bring the form into view.
    setTimeout(() => reportRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  };

  return (
    <div className="venue-detail">
      <button className="back-btn" onClick={onBack}>{t('backToMap')}</button>

      <div className="vd-hero">
        <div className="vd-icon-big"><VenueTypeIcon type={venue.type} size={40} /></div>
        <div className="vd-hero-info">
          {/* h2, not h1 — this view is rendered under the app's own site-title h1 (brief Section 14). */}
          <h2 className="vd-name">{venue.name}</h2>
          <div className="vd-meta">
            <span className="vd-type-badge">{t(`filters.types.${venue.type}`)}</span>
            {area && <span className="vd-neighbourhood">{area}</span>}
          </div>
        </div>
      </div>

      {/* Price block — the cheapest beer. The ACTUAL price is the big number; the size sits
          under it; the per-0.5 L figure (only when the size is known and isn't 0.5 L) is a
          small muted comparison, never presented as what the guest pays. */}
      {headline && (
        <div className="vd-price-block">
          <div className="vdp-main">
            <div className="vdp-amount">{headlinePrice.actual}</div>
            <SizeLine beer={headline} className="vdp-size" />
            {headlinePrice.normalized && (
              <div className="vdp-normalized">{t('price.approxPer05', { price: headlinePrice.normalized })}</div>
            )}
          </div>
          {headline.size_mass && (
            <div className="vdp-mass">
              <div className="vdp-amount-sm">{formatEuro(headline.size_mass, lang)}</div>
              <div className="vdp-label">{t('venue.priceMass')}</div>
            </div>
          )}
          <div className="vdp-brand-block">
            <div className="vdp-brand">
              🍻 {headline.brand}
              {headlineServe && <> · <ServeTypeTag serveType={headlineServe} hideUnknown /></>}
            </div>
            <div className="vdp-freshness"><FreshnessLight beer={headline} /></div>
          </div>
        </div>
      )}

      {/* Facts — each row only when it is real. */}
      <div className="vd-info-grid">
        {distance && (
          <div className="vd-info-item">
            <span className="vd-info-icon" aria-hidden="true">📍</span>
            <div className="vd-info-value">{t('venue.distanceAway', { distance })}</div>
          </div>
        )}
        {hours && (
          <div className="vd-info-item">
            <span className="vd-info-icon" aria-hidden="true">🕐</span>
            <div>
              <div className="vd-info-label">{t('venue.hours')}</div>
              <div className="vd-info-value">{hours}</div>
            </div>
          </div>
        )}
        {venue.address && (
          <div className="vd-info-item">
            <span className="vd-info-icon" aria-hidden="true">🏠</span>
            <div>
              <div className="vd-info-label">{t('venue.address')}</div>
              <div className="vd-info-value">{venue.address}</div>
            </div>
          </div>
        )}
      </div>

      <div className="vd-actions">
        <a href={links.directions} target="_blank" rel="noopener noreferrer" className="action-btn directions">
          🗺️ {t('venue.directions')}
        </a>
        <a href={links.reviews} target="_blank" rel="noopener noreferrer" className="action-btn reviews">
          {t('venue.reviews')}
        </a>
      </div>

      {/* About this place — hidden entirely when neither language has one */}
      {(venue.description_de || venue.description_en) && (
        <div className="vd-about">
          <div className="vd-about-label">ℹ️ {t('venue.aboutLabel')}</div>
          <p className="vd-description">
            {(lang === 'de' ? venue.description_de : venue.description_en) || venue.description_de || venue.description_en}
          </p>
        </div>
      )}

      {/* Other beers: brand, size, ACTUAL price, serve type (if known), the per-0.5 L
          comparison (if the size is known and isn't 0.5 L) and each one's own freshness. */}
      {otherBeers.length > 0 && (
        <div className="vd-other-beers">
          <div className="section-title">{t('venue.otherBeers')}</div>
          {otherBeers.map((b) => {
            const p = describePrice(b, lang);
            const serve = knownServeType(b);
            return (
              <div key={b.id} className="ob-row">
                <div className="ob-info">
                  <div className="ob-line">
                    <span className="ob-brand">🍻 {b.brand}</span>
                    {serve && <ServeTypeTag serveType={serve} hideUnknown />}
                  </div>
                  <SizeLine beer={b} className="ob-size" />
                  <FreshnessLight beer={b} />
                </div>
                <span className="ob-price-wrap">
                  <span className="ob-price">{p.actual}</span>
                  {p.normalized && <span className="price-approx">{t('price.approxPer05', { price: p.normalized })}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {submitSuccess && <div className="submit-success">{t('submission.success')}</div>}

      {/* Price history — separate coloured line per brand + days-at-price */}
      {!loading && (
        <div className="price-history">
          <div className="section-title">{t('priceHistory')}</div>
          <Suspense fallback={<div className="skeleton-line" style={{ height: 220 }} role="status" aria-label={t('loading')} />}>
            <BrandHistoryChart history={comparableHistory} beers={beers} />
          </Suspense>
        </div>
      )}

      <p className="vd-disclaimer">{t('venue.disclaimer')}</p>

      {/* The unified report entry point (price changed / different beer / permanently
          closed / other incorrect info), at the bottom of the sheet. */}
      <div ref={reportRef}>
        {showReport ? (
          <ReportForm
            venueId={venue.id}
            venueName={venue.name}
            onSuccess={handleSubmitSuccess}
            onCancel={() => setShowReport(false)}
          />
        ) : (
          <button className="vd-report-btn" onClick={openReport}>{t('report.button')}</button>
        )}
      </div>
    </div>
  );
}
