import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FreshnessLight from './FreshnessLight';

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

  const name = i18n.language === 'de' ? neighbourhood?.name_de : neighbourhood?.name_en;

  const sorted = [...venues].sort((a, b) => {
    if (sort === 'price') return a.beers[0].size_05 - b.beers[0].size_05;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="venue-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-neighbourhood">{name}</div>
          <div className="panel-stats">
            Ø €{neighbourhood?.avg_price?.toFixed(2)} · {venues.length} {t('map.venues')}
          </div>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      {/* Sort */}
      <div className="panel-sort">
        <span className="sort-label">{t('sortBy')}:</span>
        <button className={`sort-btn ${sort === 'price' ? 'active' : ''}`} onClick={() => setSort('price')}>
          {t('sortPrice')} ↑
        </button>
        <button className={`sort-btn ${sort === 'name' ? 'active' : ''}`} onClick={() => setSort('name')}>
          {t('sortName')}
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
                <div className="vc-price">€{v.beers[0].size_05.toFixed(2)}</div>
                <div className="vc-size">0,5L</div>
              </div>
            </div>
            <div className="vc-bottom">
              <span className="vc-brand">🍻 {v.beers[0].brand}</span>
              <ConfidenceBadge reports={v.beers[0].reports || 1} />
              <FreshnessLight date={v.beers[0].updated} />
            </div>
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
