import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRICE_LEVELS, NO_DATA_LEVEL, levelLabel, levelRange } from '../constants/priceLevels';
import { formatPrice } from '../utils/priceUtils';
import { useIsMobileLayout } from '../hooks/useMediaQuery';

// What the neighbourhood colours mean: each level's swatch WITH its name and price
// range (colour is never the only cue). The levels and ranges are read from
// constants/priceLevels.js — the same table that colours the polygons. On desktop it is
// always shown; on a phone it sits behind a small toggle so the map stays uncluttered.
export default function MapLegend() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isMobile = useIsMobileLayout();
  const [open, setOpen] = useState(false);
  const fmt = (n) => formatPrice(n, lang);

  const panel = (
    <div className="map-legend" id="map-legend" role="group" aria-label={t('map.legend.title')}>
      <div className="legend-title">{t('map.legend.title')}</div>
      <ul className="legend-levels">
        {[...PRICE_LEVELS, NO_DATA_LEVEL].map((level) => (
          <li key={level.id} className="legend-level">
            <span className="legend-swatch" style={{ background: level.color }} aria-hidden="true" />
            <span className="legend-level-name">{levelLabel(level, lang)}</span>
            <span className="legend-level-range">{levelRange(level, fmt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (!isMobile) return panel;
  return (
    <>
      <button type="button" className="legend-toggle" aria-expanded={open} aria-controls="map-legend" onClick={() => setOpen((o) => !o)}>
        {t('map.legend.toggle')}
      </button>
      {open && panel}
    </>
  );
}
