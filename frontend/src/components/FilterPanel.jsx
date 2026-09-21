import { useTranslation } from 'react-i18next';
import { BRAND_GROUPS } from '../constants/brands';
import { VENUE_TYPES } from '../constants/venueTypes';
import { neighbourhoodName } from '../utils/neighbourhoods';

const SERVE_TYPES = [
  { id: 'tap', icon: '🍺' },
  { id: 'bottle', icon: '🍾' },
  { id: 'can', icon: '🥫' },
  { id: 'unknown', icon: '❓' },
];
// "Other / Andere" and "Craft Beer (lokal)" are free-text catch-alls for
// reporting a brand — they never match an actual venue's data, so they're
// meaningless as filter options here.
const FILTERABLE_GROUPS = BRAND_GROUPS
  .map((g) => ({ ...g, brands: g.brands.filter((b) => b !== 'Other / Andere' && b !== 'Craft Beer (lokal)') }))
  .filter((g) => g.brands.length > 0);

// The full filter form (type, brand, serve type, neighbourhood, price range) — the
// existing panel, unchanged in what it filters. "Mehr" on the chip row opens it:
// inline under the chips on desktop, as a bottom sheet on mobile (App/CSS decide).
export default function FilterPanel({ filters, onFilterChange, neighbourhoods, onNeighbourhoodSelect }) {
  const { t, i18n } = useTranslation();
  const setFilter = (k, v) => onFilterChange({ ...filters, [k]: v === '__all__' ? '' : v });

  return (
    <div className="filter-grid">
      <div className="filter-group">
        <label className="filter-label" htmlFor="f-type">{t('filters.type')}</label>
        <select id="f-type" value={filters.type || '__all__'} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="__all__">{t('filters.all')}</option>
          {VENUE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`filters.types.${ty}`)}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="f-brand">{t('filters.brand')}</label>
        <select id="f-brand" value={filters.brand || '__all__'} onChange={(e) => setFilter('brand', e.target.value)}>
          <option value="__all__">{t('filters.all')}</option>
          {FILTERABLE_GROUPS.map((g) => (
            <optgroup key={g.id} label={i18n.language === 'de' ? g.label_de : g.label_en}>
              {g.brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="f-serve">{t('filters.serveType')}</label>
        <select id="f-serve" value={filters.serve_type || '__all__'} onChange={(e) => setFilter('serve_type', e.target.value)}>
          <option value="__all__">{t('filters.all')}</option>
          {SERVE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.icon} {t(`serveType.${s.id}`)}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="f-hood">{t('filters.neighbourhood')}</label>
        <select
          id="f-hood"
          value={filters.neighbourhood || '__all__'}
          onChange={(e) => {
            setFilter('neighbourhood', e.target.value);
            onNeighbourhoodSelect(e.target.value === '__all__' ? '' : e.target.value);
          }}
        >
          <option value="__all__">{t('filters.all')}</option>
          {neighbourhoods.map((n) => <option key={n.id} value={n.id}>{neighbourhoodName(n, i18n.language)}</option>)}
        </select>
      </div>

      <div className="filter-group filter-group-wide">
        <span className="filter-label" id="f-price-label">{t('filters.priceRange')}</span>
        <div className="price-range-inputs" role="group" aria-labelledby="f-price-label">
          <input type="number" inputMode="decimal" placeholder={t('filters.priceMin')} aria-label={t('filters.priceMin')} step="0.10" min="3" max="9"
            value={filters.min_price || ''} onChange={(e) => setFilter('min_price', e.target.value)} />
          <span aria-hidden="true">–</span>
          <input type="number" inputMode="decimal" placeholder={t('filters.priceMax')} aria-label={t('filters.priceMax')} step="0.10" min="3" max="9"
            value={filters.max_price || ''} onChange={(e) => setFilter('max_price', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
