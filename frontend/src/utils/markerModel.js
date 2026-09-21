// What a price-first map marker shows, as plain data (the map turns it into DOM).
// Kept pure so the rules — actual price, never the normalised one; the size only
// when it isn't 0.5 L; freshness by a text glyph and not just a tint — are unit-tested.
import { formatPrice, formatVolume, REFERENCE_VOLUME_ML, isValidVolume } from './priceUtils';
import { getFreshness } from './freshness';

// Border colour per venue type (the pill's left edge).
export const TYPE_COLORS = {
  bar: '#92400e',
  beer_garden: '#2d7a2d',
  restaurant: '#5a3d1e',
  beer_hall: '#7a4a06',
};
export const DEFAULT_TYPE_COLOR = '#92400e';

// Background tint per freshness state. Never the only cue: STALE/UNKNOWN also
// get a "!" / "?" glyph in the pill and the full wording in its aria-label.
export const FRESHNESS_TINT = {
  FRESH: '#ffffff',
  AGING: '#fffbeb',
  STALE: '#fff5f5',
  UNKNOWN: '#f5f5f5',
};
export const FRESHNESS_GLYPH = { FRESH: '', AGING: '', STALE: '!', UNKNOWN: '?' };

// The venue's headline beer is `beers[0]` (the API sorts cheapest per 0.5 L first).
// Its ACTUAL menu price is shown — €3.50 for 0.33 L reads "€3.50·0.33L", never the
// €5.30 comparison figure. A 0.5 L price shows the price alone. An unknown size
// shows "?" rather than claiming one.
export function pillModel(venue, lang, now = new Date()) {
  const beer = venue?.beers?.[0];
  const typeColor = TYPE_COLORS[venue?.type] || DEFAULT_TYPE_COLOR;
  if (!beer || !(beer.size_05 > 0)) {
    return { hasPrice: false, priceText: '—', volumeText: '', sizeUnknown: false, state: 'UNKNOWN', glyph: '', typeColor, tint: FRESHNESS_TINT.UNKNOWN };
  }
  const state = getFreshness(beer, now).state;
  const volume = beer.serving_volume_ml;
  const known = isValidVolume(volume);
  let volumeText = '';
  if (!known) volumeText = '?';
  else if (volume !== REFERENCE_VOLUME_ML) volumeText = formatVolume(volume, lang);
  return {
    hasPrice: true,
    priceText: formatPrice(beer.size_05, lang),
    volumeText,
    sizeUnknown: !known,
    state,
    glyph: FRESHNESS_GLYPH[state],
    typeColor,
    tint: FRESHNESS_TINT[state],
  };
}

// The text shown inside the pill: "€4.20" or "€3.50·0.33L".
export const pillText = (m) => (m.volumeText ? `${m.priceText}·${m.volumeText}` : m.priceText);
