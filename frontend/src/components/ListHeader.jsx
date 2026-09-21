import { useTranslation } from 'react-i18next';
import { SORT_OPTIONS } from '../utils/sortVenues';

// The top of the venue list: how many venues match (live — it changes with every filter,
// search, area or location change) and the sort options. Sorting affects this LIST only;
// the map's markers have no order. "Entfernung" is offered only while the user's location
// is active. Sort chips are a radio group (one is always selected).
export default function ListHeader({ count, sort, onSort, distanceAvailable, openNowActive }) {
  const { t } = useTranslation();
  const options = SORT_OPTIONS.filter((o) => o !== 'distance' || distanceAvailable);
  return (
    <div className="list-head">
      <div className="list-count" role="status" aria-live="polite">{t('list.found', { count })}</div>
      {openNowActive && <p className="list-note">{t('list.openNote')}</p>}
      <div className="sort-row" role="radiogroup" aria-label={t('list.sortLabel')}>
        {options.map((o) => (
          <button
            key={o} type="button" role="radio" aria-checked={sort === o}
            aria-label={t(`list.sortName.${o}`)}
            className={`chip-btn sort-chip${sort === o ? ' is-active' : ''}`}
            onClick={() => onSort(o)}
          >
            {t(`list.sort.${o}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
