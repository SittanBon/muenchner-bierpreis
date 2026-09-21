import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { QUICK_FILTERS, OPEN_NOW_CHIP, toggleQuickFilter, extraActiveFilters } from '../utils/quickFilters';
import { neighbourhoodName } from '../utils/neighbourhoods';
import { serveTypeLabel } from '../constants/serveTypes';

// One horizontally scrolling row of filter chips (no wrapping, no visible scrollbar):
//   [≤ €4] [≤ €5] [Biergarten] [Wirtshaus] [Vom Fass] [Jetzt geöffnet ·soon] (extras) [Mehr ↓]
// The quick chips write into the same `filters` object as the full panel, so they are
// only ever a shortcut. Any active filter the quick chips can't show (a brand, a
// neighbourhood, a custom maximum…) appears as a removable chip, so a filter set in
// the full panel is never invisible.
//
// "Jetzt geöffnet" is a real filter ONLY when some venue has opening hours we can read
// (openNowAvailable); otherwise it is shown disabled as "Demnächst" — never faked. It uses
// aria-disabled (not `disabled`) so a tap can still explain "coming soon".
// The map area ("Diesen Bereich durchsuchen") appears as a removable chip while it is applied.
export default function FilterChips({
  filters, onFilterChange, neighbourhoods, moreOpen, onToggleMore, onSoon, onClearAll,
  openNowAvailable = false, areaActive = false, onClearArea, activeCount = 0,
}) {
  const { t, i18n } = useTranslation();
  const extras = extraActiveFilters(filters);

  const extraLabel = (e) => {
    switch (e.id) {
      case 'brand': return e.value;
      case 'neighbourhood': return neighbourhoodName(neighbourhoods.find((n) => n.id === e.value), i18n.language);
      case 'type': return t(`filters.types.${e.value}`);
      case 'serve_type': return serveTypeLabel(e.value, i18n.language) || t('serveType.unknown');
      case 'min_price': return `${t('filters.priceMin')} ${e.value}`;
      case 'max_price': return `${t('filters.priceMax')} ${e.value}`;
      default: return e.value;
    }
  };
  const anyActive = QUICK_FILTERS.some((q) => q.isActive(filters)) || extras.length > 0 || OPEN_NOW_CHIP.isActive(filters) || areaActive;

  return (
    <div className="chip-row" role="group" aria-label={t('chips.label')}>
      {QUICK_FILTERS.map((q) => {
        const active = q.isActive(filters);
        return (
          <button
            key={q.id} type="button" className={`chip-btn${active ? ' is-active' : ''}`} aria-pressed={active}
            onClick={() => onFilterChange(toggleQuickFilter(filters, q.id))}
          >
            {q.id === 'tap' ? serveTypeLabel(q.patch.serve_type, i18n.language) : t(`chips.${q.id}`)}
          </button>
        );
      })}

      {openNowAvailable ? (
        <button
          type="button" className={`chip-btn${OPEN_NOW_CHIP.isActive(filters) ? ' is-active' : ''}`} aria-pressed={OPEN_NOW_CHIP.isActive(filters)}
          onClick={() => onFilterChange(toggleQuickFilter(filters, OPEN_NOW_CHIP.id))}
        >
          {t('chips.open')}
        </button>
      ) : (
        <button type="button" className="chip-btn is-soon" aria-disabled="true" title={t('chips.soon')} onClick={onSoon}>
          {t('chips.open')}
        </button>
      )}

      {areaActive && (
        <button type="button" className="chip-btn is-active is-extra" aria-label={t('chips.remove', { name: t('chips.area') })} onClick={onClearArea}>
          <span>{t('chips.area')}</span> <X size={14} aria-hidden="true" />
        </button>
      )}

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
        <span>{t('chips.more')}{activeCount > 0 && <span className="chip-count"> ({activeCount})</span>}</span> <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
