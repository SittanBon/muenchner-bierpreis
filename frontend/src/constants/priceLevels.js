// The price levels that colour the neighbourhood polygons (and the map legend) —
// the ONE place the thresholds and colours live. A neighbourhood's level comes from its
// average per-0.5 L price (`normalized_500ml_price`, so a 0.33 L beer and a Maß are
// compared fairly). Colour is never the only cue: the legend and the polygon tooltip
// spell out each level's name and price range.
//
//   VERY_CHEAP   < €4.50        CHEAP      €4.50 – <5.00     MODERATE   €5.00 – <5.50
//   EXPENSIVE    €5.50 – €6.00  VERY_EXPENSIVE  > €6.00      NO_DATA    nothing to average
export const PRICE_LEVELS = [
  { id: 'VERY_CHEAP', upTo: 4.5, color: '#dcfce7', label_de: 'Sehr günstig', label_en: 'Very cheap' },
  { id: 'CHEAP', upTo: 5.0, color: '#fef9c3', label_de: 'Günstig', label_en: 'Cheap' },
  { id: 'MODERATE', upTo: 5.5, color: '#ffedd5', label_de: 'Mittel', label_en: 'Moderate' },
  { id: 'EXPENSIVE', upTo: 6.0, inclusive: true, color: '#fee2e2', label_de: 'Teuer', label_en: 'Expensive' },
  { id: 'VERY_EXPENSIVE', upTo: Infinity, color: '#fecaca', label_de: 'Sehr teuer', label_en: 'Very expensive' },
];
export const NO_DATA_LEVEL = { id: 'NO_DATA', color: '#f5f5f5', label_de: 'Keine Daten', label_en: 'No data' };

// The level of a per-0.5 L price; a missing/invalid price is NO_DATA (never "cheap").
export function priceLevel(price) {
  const p = Number(price);
  if (price == null || price === '' || !Number.isFinite(p) || p <= 0) return NO_DATA_LEVEL;
  return PRICE_LEVELS.find((l) => (l.inclusive ? p <= l.upTo : p < l.upTo)) || NO_DATA_LEVEL;
}

export const levelLabel = (level, lang) => (lang === 'de' ? level.label_de : level.label_en);

// The price range of a level as text for the legend: "< €4,50", "€4,50 – €5,00", "> €6,00".
// (NO_DATA has no range.) `fmt` formats a price for the UI language.
export function levelRange(level, fmt) {
  const i = PRICE_LEVELS.findIndex((l) => l.id === level.id);
  if (i === -1) return '';
  if (i === 0) return `< ${fmt(level.upTo)}`;
  if (level.upTo === Infinity) return `> ${fmt(PRICE_LEVELS[i - 1].upTo)}`;
  return `${fmt(PRICE_LEVELS[i - 1].upTo)} – ${fmt(level.upTo)}`;
}
