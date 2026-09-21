import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { QUICK_FILTERS, toggleQuickFilter, extraActiveFilters } from '../utils/quickFilters';
import { neighbourhoodName } from '../utils/neighbourhoods';

// One horizontally scrolling row of filter chips (no wrapping, no visible scrollbar):
//   [≤ €4] [≤ €5] [Biergarten] [Wirtshaus] [Vom Fass] [Jetzt geöffnet ·soon] (extras) [Mehr ↓]
// The quick chips write into the same `filters` object as the full panel, so they are
// only ever a shortcut. Any active filter the quick chips can't show (a brand, a
// neighbourhood, a custom maximum…) appears as a removable chip, so a filter set in
// the full panel is never invisible.
//
// "Jetzt geöffnet" is shown but not functional — the app has no reliable opening-hours
// data. It uses aria-disabled (not `disabled`) so a tap can still explain "coming soon".
export default function FilterChips({ filters, onFilterChange, neighbourhoods, moreOpen, onToggleMore, onSoon, onClearAll }) {
  const { t, i18n } = useTranslation();
  const extras = extraActiveFilters(filters);

  const extraLabel = (e) => {
    switch (e.id) {
      case 'brand': return e.value;
      case 'neighbourhood': return neighbourhoodName(neighbourhoods.find((n) => n.id === e.value), i18n.language);
      case 'type': return t(`filters.types.${e.value}`);
      case 'serve_type': return t(`serveType.${e.value}`);
      case 'min_price': return `${t('filters.priceMin')} ${e.value}`;
      case 'max_price': return `${t('filters.priceMax')} ${e.value}`;
      default: return e.value;
    }
  };
  const anyActive = QUICK_FILTERS.some((q) => q.isActive(filters)) || extras.length > 0;

  return (
    <div className="chip-row" role="group" aria-label={t('chips.label')}>
      {QUICK_FILTERS.map((q) => {
        const active = q.isActive(filters);
        return (
          <button
            key={q.id} type="button" className={`chip-btn${active ? ' is-active' : ''}`} aria-pressed={active}
            onClick={() => onFilterChange(toggleQuickFilter(filters, q.id))}
          >
            {t(`chips.${q.id}`)}
          </button>
        );
      })}

      <button
        type="button" className="chip-btn is-soon" aria-disabled="true" title={t('chips.soon')}
        onClick={onSoon}
      >
        {t('chips.open')}
      </button>

      {extras.map((e) => (
        <button
          key={e.id} type="button" className="chip-btn is-active is-extra"
          aria-label={t('chips.remove', { name: extraLabel(e) })}
          onClick={() => onFilterChange({ ...filters, ...e.clear })}
        >
          <span>{extraLabel(e)}</span> <X size={14} aria-hidden="true" />
        </button>
      ))}

      {anyActive && (
        <button type="button" className="chip-btn is-reset" onClick={onClearAll}>{t('chips.reset')}</button>
      )}

      <button
        type="button" className={`chip-btn is-more${moreOpen ? ' is-open' : ''}`}
        aria-expanded={moreOpen} aria-controls="filter-sheet" onClick={onToggleMore}
      >
        {t('chips.more')} <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
