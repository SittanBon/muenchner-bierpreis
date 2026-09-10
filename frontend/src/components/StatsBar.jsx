import { useTranslation } from 'react-i18next';

// City-wide price summary shown under the navbar.
//  - average / cheapest / most-expensive tiles
//  - one toggle pill per neighbourhood showing its average (click to focus it)
export default function StatsBar({ stats, neighbourhoods, activeNeighbourhood, onSelectNeighbourhood }) {
  const { t, i18n } = useTranslation();
  if (!stats) return null;

  const de = i18n.language === 'de';
  const eur = (n) => (n == null ? '—' : `€${n.toFixed(2)}`);

  const nameById = {};
  (neighbourhoods || []).forEach((n) => { nameById[n.id] = de ? n.name_de : n.name_en; });
  const pillName = (row) => nameById[row.id] || (de ? row.name_de : row.name_en) || row.id;

  return (
    <div className="stats-bar">
      <div className="stats-tiles">
        <div className="stat-tile">
          <span className="stat-tile-label">{t('stats.cityAvg')}</span>
          <span className="stat-tile-value">{eur(stats.city_avg)}</span>
          <span className="stat-tile-sub">{stats.venue_count} {t('map.venues')}</span>
        </div>

        <button
          type="button"
          className="stat-tile stat-tile-btn cheapest"
          onClick={() => stats.cheapest && onSelectNeighbourhood(stats.cheapest.neighbourhood_id)}
          disabled={!stats.cheapest}
        >
          <span className="stat-tile-label">▼ {t('stats.cheapest')}</span>
          <span className="stat-tile-value">{eur(stats.cheapest?.price)}</span>
          <span className="stat-tile-sub">{stats.cheapest?.name || '—'}</span>
        </button>

        <button
          type="button"
          className="stat-tile stat-tile-btn priciest"
          onClick={() => stats.most_expensive && onSelectNeighbourhood(stats.most_expensive.neighbourhood_id)}
          disabled={!stats.most_expensive}
        >
          <span className="stat-tile-label">▲ {t('stats.priciest')}</span>
          <span className="stat-tile-value">{eur(stats.most_expensive?.price)}</span>
          <span className="stat-tile-sub">{stats.most_expensive?.name || '—'}</span>
        </button>
      </div>

      <div className="stats-pills" role="group" aria-label={t('stats.byNeighbourhood')}>
        <span className="stats-pills-label">{t('stats.byNeighbourhood')}:</span>
        {(stats.by_neighbourhood || []).map((n) => {
          const active = activeNeighbourhood === n.id;
          return (
            <button
              key={n.id}
              type="button"
              className={`stats-pill ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => onSelectNeighbourhood(active ? null : n.id)}
            >
              <span className="stats-pill-name">{pillName(n)}</span>
              <span className="stats-pill-price">{eur(n.avg_price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
