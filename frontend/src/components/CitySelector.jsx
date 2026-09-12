import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCities } from '../hooks/useApi';

const FLAGS = { DE: '🇩🇪', AT: '🇦🇹' };

// Only Munich is a real, clickable city today — everything else is a
// "coming soon" placeholder that previews the multi-city architecture without
// actually switching any app state when picked (there's nowhere else to go
// yet). Selecting the already-active city just closes the dropdown.
export default function CitySelector() {
  const { t, i18n } = useTranslation();
  const [cities, setCities] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeCityId, setActiveCityId] = useState(1); // Munich

  useEffect(() => { fetchCities().then(setCities).catch(() => {}); }, []);

  if (cities.length === 0) return null;

  const de = i18n.language === 'de';
  const cityName = (c) => (de ? c.name : c.name_en);
  const current = cities.find((c) => c.id === activeCityId) || cities[0];

  const selectCity = (c) => {
    if (!c.is_active) return; // coming-soon cities aren't clickable
    setActiveCityId(c.id);
    setOpen(false);
  };

  return (
    <div className="city-selector">
      <button
        type="button"
        className="city-selector-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="city-flag">{FLAGS[current.country_code] || '🏙️'}</span>
        <span className="city-name">{cityName(current)}</span>
        <span className="city-caret">▾</span>
      </button>

      {open && (
        <>
          <div className="city-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="city-dropdown" role="listbox">
            {cities.map((c) => {
              const selected = c.id === activeCityId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`city-option ${c.is_active ? '' : 'disabled'} ${selected ? 'selected' : ''}`}
                  onClick={() => selectCity(c)}
                  disabled={!c.is_active}
                  title={c.coming_soon ? t('citySelector.comingSoonTooltip', { city: cityName(c) }) : undefined}
                >
                  <span className="city-option-flag">{FLAGS[c.country_code] || '🏙️'}</span>
                  <span className="city-option-name">
                    {cityName(c)}
                    {c.coming_soon && <span className="city-option-soon"> — {t('citySelector.comingSoon')}</span>}
                  </span>
                  {selected && <span className="city-check">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
