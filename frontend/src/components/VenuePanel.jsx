import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FreshnessLight from './FreshnessLight';
import { formatEuro } from '../utils/price';

const TYPE_ICONS = {
  beer_garden: '🌳',
  beer_hall: '🏛️',
  bar: '🍺',
  restaurant: '🍽️'
};

function ConfidenceBadge({ reports }) {
  const { t } = useTranslation();
  const level = reports >= 4 ? 'high' : reports >= 2 ? 'medium' : 'low';
  const colors = { high: '#2d7a2d', medium: '#a06400', low: '#888' };
  const bg = { high: '#e6f4e6', medium: '#fff3d6', low: '#f0f0f0' };
  return (
    <span style={{
      fontSize: '11px', padding: '2px 7px', borderRadius: '20px',
      color: colors[level], background: bg[level], fontWeight: 500
    }}>
      {reports} {t('venue.reports')}
    </span>
  );
}

export default function VenuePanel({ neighbourhood, venues, onVenueClick, onClose, onSubmitNew }) {
  const { t, i18n } = useTranslation();
  const [sort, setSort] = useState('price');
  const [sortDir, setSortDir] = useState('asc');

  const name = i18n.language === 'de' ? neighbourhood?.name_de : neighbourhood?.name_en;

  // Clicking the already-active sort button flips direction; picking a new key
  // starts it ascending. Reads `sort` directly from render scope and calls each
  // setter independently — nesting a setSortDir call inside setSort's updater
  // (the previous approach) gets double-invoked by StrictMode in dev, which
  // toggled the direction twice and silently cancelled itself out.
  const setSortKey = (key) => {
    if (sort === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setSortDir('asc');
    }
  };

  const price = (v) => v.beers?.[0]?.size_05 ?? Infinity;
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = [...venues].sort((a, b) => {
    if (sort === 'price') return (price(a) - price(b)) * dir;
    return a.name.localeCompare(b.name) * dir;
  });

  return (
    <div className="venue-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-neighbourhood">{name}</div>
          <div className="panel-stats">
            Ø {formatEuro(neighbourhood?.avg_price, i18n.language)} · {venues.length} {t('map.venues')}
          </div>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      {/* Sort */}
      <div className="panel-sort">
        <span className="sort-label">{t('sortBy')}:</span>
        <button className={`sort-btn ${sort === 'price' ? 'active' : ''}`} onClick={() => setSortKey('price')}>
          {t('sortPrice')} {sort === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : '↑'}
        </button>
        <button className={`sort-btn ${sort === 'name' ? 'active' : ''}`} onClick={() => setSortKey('name')}>
          {t('sortName')} {sort === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>

      {/* Venue list */}
      <div className="venue-list">
        {sorted.length === 0 && (
          <div className="no-venues">{t('search.noResults')}</div>
        )}
        {sorted.map(v => (
          <div key={v.id} className="venue-card" onClick={() => onVenueClick(v)}>
            <div className="vc-top">
              <div className="vc-icon">{TYPE_ICONS[v.type] || '🍺'}</div>
              <div className="vc-info">
                <div className="vc-name">{v.name}</div>
                <div className="vc-type">{t(`filters.types.${v.type}`)}</div>
              </div>
              <div className="vc-price-block">
                <div className="vc-price">{formatEuro(v.beers[0]?.size_05, i18n.language)}</div>
                <div className="vc-size">0,5L</div>
              </div>
            </div>
            <div className="vc-bottom">
              <span className="vc-brand">🍻 {v.beers[0]?.brand}</span>
              <ConfidenceBadge reports={v.beers[0].reports || 1} />
              <FreshnessLight date={v.beers[0].updated} />
            </div>
            {v.beers.length > 1 && (
              <div className="vc-brands-count">🍺 {t('venue.brandsCount', { count: v.beers.length })}</div>
            )}
          </div>
        ))}
      </div>

      {/* Add new venue */}
      <div className="panel-footer">
        <button className="add-venue-btn" onClick={onSubmitNew}>
          + {t('submission.newVenue')}
        </button>
      </div>
    </div>
  );
}
