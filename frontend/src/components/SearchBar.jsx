import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const BRANDS = ['Augustiner', 'Paulaner', 'Hofbräu', 'Hacker-Pschorr', 'Löwenbräu', 'Spaten', 'Andechs', 'Ayinger', 'Haderner'];
const TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];
const NEIGHBOURHOODS = [
  { id: 'altstadt', de: 'Altstadt', en: 'Old Town' },
  { id: 'maxvorstadt', de: 'Maxvorstadt', en: 'Maxvorstadt' },
  { id: 'schwabing', de: 'Schwabing', en: 'Schwabing' },
  { id: 'isarvorstadt', de: 'Isarvorstadt', en: 'Isarvorstadt' }
];

export default function SearchBar({ onSearch, onFilterChange, filters, onNeighbourhoodSelect }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (val) => {
    setQuery(val);
    onSearch(val);
  };

  const setFilter = (k, v) => {
    onFilterChange({ ...filters, [k]: v === '__all__' ? '' : v });
  };

  const activeFilterCount = [filters.type, filters.brand, filters.neighbourhood, filters.min_price].filter(Boolean).length;

  const clearAll = () => {
    onFilterChange({ type: '', brand: '', neighbourhood: '', min_price: '', max_price: '' });
    handleSearch('');
  };

  return (
    <div className="search-bar-wrapper">
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={e => handleSearch(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => handleSearch('')}>✕</button>
          )}
        </div>
        <button
          className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(s => !s)}
        >
          ⚙️ {t('search.filters')}
          {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="filter-chips">
          {filters.type && (
            <span className="chip">{t(`filters.types.${filters.type}`)} <button onClick={() => setFilter('type', '__all__')}>✕</button></span>
          )}
          {filters.brand && (
            <span className="chip">{filters.brand} <button onClick={() => setFilter('brand', '__all__')}>✕</button></span>
          )}
          {filters.neighbourhood && (
            <span className="chip">
              {NEIGHBOURHOODS.find(n => n.id === filters.neighbourhood)?.[i18n.language === 'de' ? 'de' : 'en']}
              <button onClick={() => { setFilter('neighbourhood', '__all__'); onNeighbourhoodSelect(''); }}>✕</button>
            </span>
          )}
          {(filters.min_price || filters.max_price) && (
            <span className="chip">€{filters.min_price || '0'}–€{filters.max_price || '∞'}
              <button onClick={() => { setFilter('min_price', ''); setFilter('max_price', ''); }}>✕</button>
            </span>
          )}
          <button className="chip chip-clear" onClick={clearAll}>{t('search.clear')}</button>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-grid">
            {/* Type */}
            <div className="filter-group">
              <label className="filter-label">{t('filters.type')}</label>
              <select value={filters.type || '__all__'} onChange={e => setFilter('type', e.target.value)}>
                <option value="__all__">{t('filters.all')}</option>
                {TYPES.map(t2 => <option key={t2} value={t2}>{t(`filters.types.${t2}`)}</option>)}
              </select>
            </div>

            {/* Brand */}
            <div className="filter-group">
              <label className="filter-label">{t('filters.brand')}</label>
              <select value={filters.brand || '__all__'} onChange={e => setFilter('brand', e.target.value)}>
                <option value="__all__">{t('filters.all')}</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Neighbourhood */}
            <div className="filter-group">
              <label className="filter-label">{t('filters.neighbourhood')}</label>
              <select value={filters.neighbourhood || '__all__'}
                onChange={e => {
                  setFilter('neighbourhood', e.target.value);
                  onNeighbourhoodSelect(e.target.value === '__all__' ? '' : e.target.value);
                }}>
                <option value="__all__">{t('filters.all')}</option>
                {NEIGHBOURHOODS.map(n => (
                  <option key={n.id} value={n.id}>
                    {i18n.language === 'de' ? n.de : n.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div className="filter-group">
              <label className="filter-label">{t('filters.priceRange')}</label>
              <div className="price-range-inputs">
                <input type="number" placeholder="min €" step="0.10" min="3" max="9"
                  value={filters.min_price || ''}
                  onChange={e => setFilter('min_price', e.target.value)} />
                <span>–</span>
                <input type="number" placeholder="max €" step="0.10" min="3" max="9"
                  value={filters.max_price || ''}
                  onChange={e => setFilter('max_price', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
