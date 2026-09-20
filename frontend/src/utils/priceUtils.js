// Frontend mirror of backend/utils/priceUtils.js's normalisation + formatting.
// The two MUST behave identically — backend/priceUtilsParity.test.js runs both
// against the same cases. The backend is authoritative: every API beer already
// carries `normalized_500ml_price`, so components use that field and only fall
// back to computing it here for objects that lack it.

export const REFERENCE_VOLUME_ML = 500;
// Serving sizes the app understands (ml). The report form offers these; the
// API rejects anything else.
export const SERVING_SIZES = [
  { size: '0.25L', ml: 250 },
  { size: '0.33L', ml: 330 },
  { size: '0.4L', ml: 400 },
  { size: '0.5L', ml: 500 },
  { size: '1L', ml: 1000 },
];
export const VALID_VOLUMES_ML = SERVING_SIZES.map((s) => s.ml);

export function isValidVolume(ml) {
  return Number.isInteger(ml) && VALID_VOLUMES_ML.includes(ml);
}

// actual price / serving volume × 500 ml, rounded to cents; null whenever
// either input is missing or nonsensical — never the raw price, never 0 — so an
// unknown-size price can't be presented as a fair 0.5 L comparison.
// e.g. €3.50 for 330 ml -> €5.30 per 0.5 L.
export function normalizePrice(actualPrice, volumeMl) {
  const price = Number(actualPrice);
  const volume = Number(volumeMl);
  if (!Number.isFinite(price) || !Number.isFinite(volume) || price <= 0 || volume <= 0) return null;
  return Math.round((price / volume * REFERENCE_VOLUME_ML) * 100) / 100;
}

// "€4,80" (de) / "€4.80" (en); null/NaN -> "—".
export function formatPrice(price, lang) {
  if (price == null || Number.isNaN(Number(price))) return '—';
  const fixed = Number(price).toFixed(2);
  return lang === 'de' ? '€' + fixed.replace('.', ',') : '€' + fixed;
}

// 500 -> "0.5L" (en) / "0,5L" (de); 1000 -> "1L"; unknown -> null.
export function formatVolume(ml, lang) {
  if (!isValidVolume(ml)) return null;
  const s = `${ml / 1000}L`;
  return lang === 'de' ? s.replace('.', ',') : s;
}

// Everything a view needs to show one beer's price under the P0 display rules:
//   * the ACTUAL menu price is primary — `actual` is always the real price;
//   * the serving size sits with it (`volumeLabel`), or `sizeUnknown` is set;
//   * the 0.5 L comparison (`normalized`) is secondary and only present when
//     the size is known AND is not already 0.5 L. It is a comparison figure,
//     never what the customer pays.
export function describePrice(beer, lang) {
  const volume = beer?.serving_volume_ml ?? null;
  const known = isValidVolume(volume);
  const normalized = beer?.normalized_500ml_price !== undefined
    ? beer.normalized_500ml_price
    : normalizePrice(beer?.size_05, volume);
  const showNormalized = known && volume !== REFERENCE_VOLUME_ML && normalized != null;
  return {
    actual: formatPrice(beer?.size_05, lang),
    volumeLabel: known ? formatVolume(volume, lang) : null,
    sizeUnknown: !known,
    isReferenceSize: known && volume === REFERENCE_VOLUME_ML,
    normalized: showNormalized ? formatPrice(normalized, lang) : null,
  };
}
