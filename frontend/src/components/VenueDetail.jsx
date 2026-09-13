import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { fetchVenue } from '../hooks/useApi';
import ReportForm from './ReportForm';
import FreshnessLight from './FreshnessLight';
import ServeTypeTag from './ServeTypeTag';
import { formatEuro } from '../utils/price';

const TYPE_ICONS = { beer_garden: '🌳', beer_hall: '🏛️', bar: '🍺', restaurant: '🍽️' };

// Same validated categorical order used for the Price Trends chart (dataviz
// skill's default palette) — assigned by the beer's position in the venue's
// (already cheapest-first) list, so a brand keeps its colour across renders.
const BRAND_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Per-brand history rows with "days at this price" — the days between a price
// taking effect and the next reported change for that SAME brand (or today, if
// it's still the current price).
function daysAtPriceRows(history) {
  const byBrand = {};
  (history || []).forEach((h) => { (byBrand[h.beer_brand] ||= []).push(h); });

  const today = new Date();
  const rows = [];
  for (const [brand, entries] of Object.entries(byBrand)) {
    const sorted = [...entries].sort((a, b) => a.visit_date.localeCompare(b.visit_date));
    sorted.forEach((h, i) => {
      const start = new Date(h.visit_date);
      const end = i < sorted.length - 1 ? new Date(sorted[i + 1].visit_date) : today;
      const days = Math.max(0, Math.round((end - start) / DAY_MS));
      rows.push({ ...h, brand, days, isCurrent: i === sorted.length - 1 });
    });
  }
  return rows.sort((a, b) => b.visit_date.localeCompare(a.visit_date));
}

function BrandHistoryChart({ history, beers }) {
  const { t, i18n } = useTranslation();
  const brands = useMemo(() => beers.map((b) => b.brand), [beers]);
  const [visible, setVisible] = useState(() => new Set(brands));

  useEffect(() => { setVisible(new Set(brands)); }, [brands]);

  const colorFor = (brand) => {
    const i = brands.indexOf(brand);
    return BRAND_COLORS[i >= 0 ? i % BRAND_COLORS.length : 0];
  };

  const chartData = useMemo(() => {
    if (!history?.length) return [];
    const byDate = {};
    [...history].sort((a, b) => a.visit_date.localeCompare(b.visit_date)).forEach((h) => {
      const row = byDate[h.visit_date] || (byDate[h.visit_date] = { date: h.visit_date });
      row[h.beer_brand] = h.price;
    });
    return Object.values(byDate);
  }, [history]);

  const rows = useMemo(() => daysAtPriceRows(history), [history]);

  const toggle = (brand) => {
    setVisible((v) => {
      const next = new Set(v);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });
  };

  if (!history?.length) {
    return <div className="vdp-history-empty">{t('venue.noHistory')}</div>;
  }

  return (
    <div className="brand-history">
      <div className="brand-history-toggles">
        {brands.map((brand) => (
          <button
            key={brand}
            type="button"
            className={`trends-toggle ${visible.has(brand) ? 'active' : ''}`}
            style={{ '--tc': colorFor(brand) }}
            onClick={() => toggle(brand)}
            aria-pressed={visible.has(brand)}
          >
            <span className="trends-swatch" />
            {brand}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={{ stroke: 'var(--border-md)' }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatEuro(v, i18n.language)}
            width={48}
          />
          <Tooltip
            formatter={(value, key) => [formatEuro(value, i18n.language), key]}
            contentStyle={{ background: 'var(--amber-900)', border: 'none', borderRadius: 10, color: 'var(--amber-100)' }}
            itemStyle={{ color: 'var(--amber-100)' }}
            labelStyle={{ color: 'var(--amber-200)', fontWeight: 600 }}
          />
          {brands.filter((b) => visible.has(b)).map((brand) => (
            <Line
              key={brand}
              type="monotone"
              dataKey={brand}
              name={brand}
              stroke={colorFor(brand)}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Days-at-price list */}
      <div className="days-at-price-list">
        {rows.map((r, i) => (
          <div key={i} className="dap-row">
            <span className="dap-swatch" style={{ background: colorFor(r.brand) }} />
            <span className="dap-brand">{r.brand}</span>
            <span className="dap-price">{formatEuro(r.price, i18n.language)}</span>
            <span className="dap-date">{new Date(r.visit_date).toLocaleDateString()}</span>
            <span className="dap-days">{t('venue.daysAtPrice', { count: r.days })}{r.isCurrent ? ` (${t('venue.current')})` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const headline = beers[0]; // cheapest active beer — the API sorts beers ASC by price
  const otherBeers = beers.slice(1);
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

      {/* Headline price block — always the cheapest active beer */}
      {headline && (
        <div className="vd-price-block">
          <div className="vdp-main">
            <div className="vdp-amount">{formatEuro(headline.size_05, i18n.language)}</div>
            <div className="vdp-label">{t('venue.price05')}</div>
          </div>
          {headline.size_mass && (
            <div className="vdp-mass">
              <div className="vdp-amount-sm">{formatEuro(headline.size_mass, i18n.language)}</div>
              <div className="vdp-label">{t('venue.priceMass')}</div>
            </div>
          )}
          <div className="vdp-brand-block">
            <div className="vdp-brand">🍻 {headline.brand}</div>
            <div className="vdp-updated">
              {t('venue.lastUpdated')}: {new Date(headline.updated).toLocaleDateString()}
            </div>
            <div className="vdp-serve-type"><ServeTypeTag serveType={headline.serve_type} /></div>
            <div className="vdp-freshness">
              <FreshnessLight date={headline.updated} />
            </div>
          </div>
        </div>
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
                <FreshnessLight date={b.updated} compact />
              </div>
              <span className="ob-price">{formatEuro(b.size_05, i18n.language)}</span>
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
          <BrandHistoryChart history={venue.price_history} beers={beers} />
        </div>
      )}

      {/* Disclaimer */}
      <p className="vd-disclaimer">{t('venue.disclaimer')}</p>

      {/* Unified report entry point — always the last element */}
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
    </div>
  );
}
