import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FreshnessLight from './FreshnessLight';
import PriceSecondary from './PriceSecondary';
import { formatPrice, describePrice } from '../utils/priceUtils';
import { formatDistance } from '../utils/geo';

// One row = one real <button> (the whole row is the tap target): venue name, the
// headline beer + its serving size, the price (largest thing in the row), and the
// freshness WITH its text label. A distance is shown only when the venue carries a
// real `distance_m` (i.e. the user shared their location) — never a made-up one.
const VenueRow = memo(function VenueRow({ venue, active, onClick, onHover }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const ref = useRef(null);
  const beer = venue.beers?.[0];
  const p = beer ? describePrice(beer, lang) : null;
  const distance = venue.distance_m != null ? formatDistance(venue.distance_m, lang) : null;

  // A marker tapped on the map scrolls its row into view (map <-> list stay in step).
  useEffect(() => {
    if (active && ref.current?.scrollIntoView) ref.current.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const sub = [beer?.brand, p && (p.sizeUnknown ? t('price.sizeUnknown') : p.volumeLabel), distance].filter(Boolean).join(' · ');

  return (
    <li>
      <button
        ref={ref} type="button" className={`vl-row${active ? ' is-active' : ''}`}
        onClick={() => onClick(venue)}
        onMouseEnter={() => onHover?.(venue.id)} onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(venue.id)} onBlur={() => onHover?.(null)}
      >
        <span className="vl-main">
          <span className="vl-name">
            {venue.name}
            {venue.beers.length > 1 && <span className="vl-more"> · 🍺 {t('venue.brandsCount', { count: venue.beers.length })}</span>}
          </span>
          {sub && <span className="vl-sub">{sub}</span>}
          {beer && <FreshnessLight beer={beer} />}
        </span>
        <span className="vl-price">
          <span className="vl-price-main">{beer && beer.size_05 > 0 ? formatPrice(beer.size_05, lang) : '—'}</span>
          {beer && <PriceSecondary beer={beer} />}
        </span>
      </button>
    </li>
  );
});

// The venue list: same dataset, filters and search as the map (App passes the very
// same array), already sorted by the caller.
export default function VenueList({ venues, highlightId, onVenueClick, onHover }) {
  return (
    <ul className="vl-list">
      {venues.map((v) => (
        <VenueRow key={v.id} venue={v} active={v.id === highlightId} onClick={onVenueClick} onHover={onHover} />
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
