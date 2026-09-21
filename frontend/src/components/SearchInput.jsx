import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// The public search field. Controlled by the app (`value` / `onChange`), so anything
// that resets the search — e.g. "reset all filters" — can clear it. The 300 ms
// debounce and request sequencing that make typing cheap live in App (unchanged).
// Enter fires an immediate search, Escape clears — as before.
export default function SearchInput({ value, onChange, onSearchNow, onFocus, resultCount, onShowList }) {
  const { t } = useTranslation();
  const query = value.trim();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSearchNow?.();
    else if (e.key === 'Escape' && value) onChange('');
  };

  return (
    <div className="search-block">
      <div className="search-field">
        <Search className="search-field-icon" size={20} aria-hidden="true" />
        <input
          className="search-field-input"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button type="button" className="search-field-clear" onClick={() => onChange('')} aria-label={t('search.clearInput')}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Live confirmation that the search is doing something, right where it was typed */}
      {query && typeof resultCount === 'number' && (
        <div className="search-result-count" role="status">
          <span>{t('search.resultsFor', { count: resultCount, query })}</span>
          {onShowList && resultCount > 0 && (
            <button type="button" className="search-show-list" onClick={onShowList}>{t('search.showAsList')}</button>
          )}
        </div>
      )}
    </div>
  );
}
