// Frontend mirror of backend/utils/priceUtils.js's normalisation + formatting.
// The two MUST behave identically — backend/priceUtilsParity.test.js runs both
// against the same cases. The backend is authoritative: every API beer already
// carries `normalized_500ml_price`, so components use that field and only fall
// back to computing it here for objects that lack it.

import { SERVING_SIZES, VALID_VOLUMES_ML, REFERENCE_VOLUME_ML, servingLabel } from '../constants/servingSizes.js';

// The serving-size list lives in constants/servingSizes.js (the single source);
// re-exported here so existing imports keep working.
export { SERVING_SIZES, VALID_VOLUMES_ML, REFERENCE_VOLUME_ML };

// Where a price came from (admin-only metadata). Mirrors SOURCE_TYPES in
// backend/utils/priceUtils.js (the parity test keeps them equal).
export const SOURCE_TYPES = ['ADMIN', 'COMMUNITY', 'VENUE', 'MENU_PHOTO', 'OTHER'];
export const NOTES_MAX_LENGTH = 500;

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
  // Multiply BEFORE dividing and round on a 12-significant-digit value: the other
  // order (price / volume × 500) turns €2.90 @ 400 ml into 3.6249999… and rounds
  // it DOWN to €3.62, while the true half-cent value €3.625 rounds up to €3.63 —
  // which is what the SQL version of this formula gives. Cents are exact here.
  const cents = Math.round(Number((price * REFERENCE_VOLUME_ML / volume * 100).toPrecision(12)));
  return cents / 100;
}

// "€4,80" (de) / "€4.80" (en); null/NaN -> "—".
export function formatPrice(price, lang) {
  if (price == null || Number.isNaN(Number(price))) return '—';
  const fixed = Number(price).toFixed(2);
  return lang === 'de' ? '€' + fixed.replace('.', ',') : '€' + fixed;
}

// 500 -> "0.50L" (en) / "0,50L" (de); 1000 -> "1.00L"; unknown -> null.
// The label comes from constants/servingSizes.js, so a size reads the same in
// every dropdown and on every card.
export function formatVolume(ml, lang) {
  if (!isValidVolume(ml)) return null;
  return servingLabel(ml, lang);
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
