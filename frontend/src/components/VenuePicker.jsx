import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeText } from '../utils/adminSearch';
import { formatPrice } from '../utils/priceUtils';

const MAX_RESULTS = 6;

// Step 0 of the report flow when it is opened WITHOUT a venue (the bottom-nav "+ Preis
// melden"): find the venue by name or address. Matching ignores case and accents. A venue that
// isn't in the list at all leads to the "Missing a bar?" flow.
export default function VenuePicker({ venues, onPick, onNewVenue }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = normalizeText(query.trim());
    if (q.length < 2) return [];
    return (venues || [])
      .filter((v) => normalizeText(`${v.name} ${v.address || ''}`).includes(q))
      .slice(0, MAX_RESULTS);
  }, [venues, query]);
  const searched = query.trim().length >= 2;

  return (
    <div className="report-picker">
      <label className="sf-field" htmlFor="report-venue-search">
        <span className="report-label">{t('report.pickVenue')}</span>
        <input
          id="report-venue-search" type="search" autoComplete="off" autoFocus enterKeyHint="search"
          placeholder={t('report.pickVenuePlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {matches.length > 0 && (
        <ul className="report-picker-list">
          {matches.map((v) => {
            const beer = v.beers?.[0];
            const area = lang === 'de' ? v.neighbourhood_name_de : v.neighbourhood_name_en;
            return (
              <li key={v.id}>
                <button type="button" className="report-picker-item" onClick={() => onPick(v)}>
                  <span className="rp-main">
                    <span className="rp-name">{v.name}</span>
                    <span className="rp-sub">{[t(`filters.types.${v.type}`), area].filter(Boolean).join(' · ')}</span>
                  </span>
                  {beer && beer.size_05 > 0 && <span className="rp-price">{formatPrice(beer.size_05, lang)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {searched && matches.length === 0 && <p className="report-picker-none">{t('report.pickNone')}</p>}

      <button type="button" className="report-picker-new" onClick={() => onNewVenue(query.trim())}>
        {t('report.newVenueLink')}
      </button>
    </div>
  );
}
