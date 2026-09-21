import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FreshnessLight from './FreshnessLight';
import PriceSecondary from './PriceSecondary';
import { formatPrice } from '../utils/priceUtils';
import { priceAria } from '../utils/venueView';
import { formatDistance } from '../utils/geo';

// One card = one real <button> (the whole card is the tap target, ≥64px tall):
//   left  — venue name, "type · neighbourhood", the headline beer, its freshness (dot + TEXT)
//   right — the ACTUAL price (largest thing on the card), its serving size, the per-0.5 L
//           comparison (only when the size is known and isn't 0.5 L), and the distance.
// The distance appears only when the venue carries a real `distance_m` (the user shared
// their location) — never a made-up one. An unknown serving size says "Größe unbekannt".
const VenueRow = memo(function VenueRow({ venue, active, onClick, onHover, onFixPrice }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const ref = useRef(null);
  const beer = venue.beers?.[0];
  const distance = venue.distance_m != null ? formatDistance(venue.distance_m, lang) : null;
  const area = lang === 'de' ? venue.neighbourhood_name_de : venue.neighbourhood_name_en;
  const where = [t(`filters.types.${venue.type}`), area].filter(Boolean).join(' · ');

  // A marker tapped on the map scrolls its WHOLE card (row + correction link) into view (map <-> list stay in step).
  useEffect(() => {
    if (active && ref.current?.scrollIntoView) ref.current.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <li ref={ref} className={`vl-item${active ? ' is-active' : ''}`}>
      <button
        type="button" className="vl-row"
        onClick={() => onClick(venue)}
        onMouseEnter={() => onHover?.(venue.id)} onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(venue.id)} onBlur={() => onHover?.(null)}
      >
        <span className="vl-main">
          <span className="vl-name">
            {venue.name}
            {venue.beers.length > 1 && <span className="vl-more"> · 🍺 {t('venue.brandsCount', { count: venue.beers.length })}</span>}
          </span>
          {where && <span className="vl-where">{where}</span>}
          {beer?.brand && <span className="vl-brand">🍻 {beer.brand}</span>}
          {beer && <FreshnessLight beer={beer} />}
        </span>
        <span className="vl-price">
          <span className="vl-price-main" role="img" aria-label={priceAria(beer, lang) || undefined}>{beer && beer.size_05 > 0 ? formatPrice(beer.size_05, lang) : '—'}</span>
          {beer && <PriceSecondary beer={beer} showReferenceSize />}
          {distance && <span className="vl-distance">📍 {distance}</span>}
        </span>
      </button>
      {/* A separate control (a card cannot be a button that contains a button): the subtle
          "Preis falsch? → Korrigieren" — opens the report flow pre-filled for this venue. */}
      {beer && onFixPrice && (
        <button type="button" className="wrong-price-link vl-fix" onClick={() => onFixPrice(venue, 'price_change')}>
          {t('report.wrongPrice')}
        </button>
      )}
    </li>
  );
});

// The venue list: same dataset, filters and search as the map (App passes the very
// same array), already sorted by the caller.
export default function VenueList({ venues, highlightId, onVenueClick, onHover, onFixPrice }) {
  return (
    <ul className="vl-list">
      {venues.map((v) => (
        <VenueRow key={v.id} venue={v} active={v.id === highlightId} onClick={onVenueClick} onHover={onHover} onFixPrice={onFixPrice} />
      ))}
    </ul>
  );
}

// Skeleton rows shown while the first load is running — a loading list, not a spinner.
export function VenueListSkeleton({ rows = 6 }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t('loadingVenues')}</span>
      <div className="venue-skeleton-list" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="venue-skeleton-item">
            <div className="skeleton-line skeleton-line-name" />
            <div className="skeleton-line skeleton-line-price" />
          </div>
        ))}
      </div>
    </div>
  );
}
