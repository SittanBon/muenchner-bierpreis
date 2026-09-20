import { useState, useRef, useId, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_GROUPS, BRANDS } from '../constants/brands';

// Wraps the part of `text` that matches `query` (case-insensitive) in <mark>.
function Highlighted({ text, query }) {
  if (!query.trim()) return text;
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.trim().length)}</mark>
      {text.slice(i + query.trim().length)}
    </>
  );
}

// Searchable brand picker used everywhere a beer brand is entered (report
// form, admin add/edit venue, missing-bar modal). It's a plain text <input>
// underneath — the value IS whatever's typed, so free text always works, even
// for a brand that isn't in the list — with a custom dropdown layered on top
// for search/browse. A <datalist> mirrors the same options natively, so the
// field still autocompletes via the browser's own UI if the custom dropdown's
// JS hasn't taken over yet (a slow connection, a bug, JS disabled).
export default function BrandCombobox({ value, onChange, placeholder, id, exclude }) {
  const { i18n, t } = useTranslation();
  const de = i18n.language === 'de';
  const reactId = useId();
  const datalistId = `brand-list-${id || reactId}`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const blurTimer = useRef(null);

  const query = value || '';
  const excludeSet = useMemo(() => new Set(exclude || []), [exclude]);
  const availableBrands = useMemo(() => BRANDS.filter((b) => !excludeSet.has(b)), [excludeSet]);

  // Groups filtered to the current query (and any excluded brands, e.g. ones a
  // venue already lists); empty groups are dropped. With no query, every
  // group/brand shows (browse mode).
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BRAND_GROUPS
      .map((g) => ({
        ...g,
        brands: g.brands.filter((b) => !excludeSet.has(b) && (!q || b.toLowerCase().includes(q))),
      }))
      .filter((g) => g.brands.length > 0);
  }, [query, excludeSet]);

  const flatVisible = useMemo(() => filteredGroups.flatMap((g) => g.brands), [filteredGroups]);
  const noResults = query.trim() !== '' && flatVisible.length === 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, open]);

  const pick = (brand) => {
    onChange(brand);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleBlur = () => {
    // Delay so a click on a dropdown item (which also blurs the input) still
    // registers before we tear the list down.
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  };
  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  };
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(flatVisible.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && flatVisible[activeIndex]) {
        e.preventDefault();
        pick(flatVisible[activeIndex]);
      } else {
        setOpen(false); // Enter with nothing highlighted just confirms the typed free text
      }
    }
  };

  return (
    <div className="brand-combobox" ref={wrapRef}>
      <div className="brand-combobox-input-wrap">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          list={datalistId}
          className="brand-combobox-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            className="brand-combobox-clear"
            aria-label={t('brandPicker.clear')}
            onMouseDown={(e) => e.preventDefault()} // keep focus, don't blur before onClick fires
            onClick={() => { onChange(''); setOpen(true); }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Native fallback: works via the browser's own autocomplete even before
          (or without) the custom dropdown below taking over. */}
      <datalist id={datalistId}>
        {availableBrands.map((b) => <option key={b} value={b} />)}
      </datalist>

      {open && (
        <ul className="brand-combobox-dropdown" role="listbox">
          {filteredGroups.map((g) => (
            <li key={g.id} className="brand-combobox-group">
              <div className="brand-combobox-group-label">{de ? g.label_de : g.label_en}</div>
              <ul>
                {g.brands.map((b) => {
                  const flatIndex = flatVisible.indexOf(b);
                  return (
                    <li key={b}>
                      <button
                        type="button"
                        className={`brand-combobox-option ${flatIndex === activeIndex ? 'active' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(b)}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        role="option"
                        aria-selected={value === b}
                      >
                        <Highlighted text={b} query={query} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {noResults && (
            <li className="brand-combobox-noresults">
              {t('brandPicker.noResults', { query: query.trim() })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
