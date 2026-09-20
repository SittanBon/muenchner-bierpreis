// Shared price parsing so every price input in the app agrees on the same rule:
// accept German (comma) or English (dot) decimals on input and store a plain
// number. Display formatting is in ./priceUtils (re-exported below as formatEuro).

// "4,80" or "4.80" (or "4") -> 4.8. Returns null if the input isn't a valid price.
export function parsePrice(input) {
  if (input == null) return null;
  const cleaned = String(input).trim().replace(',', '.');
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

// Rendering lives in ONE place: formatPrice in ./priceUtils ("€4,80" de /
// "€4.80" en, "—" for null/NaN). `formatEuro` is kept as an alias so existing
// call sites read the same; there is deliberately no second implementation
// (there used to be a euro-less formatPrice here that behaved differently from
// the one in priceUtils under the same name).
export { formatPrice as formatEuro } from './priceUtils';

// Bilingual placeholder shown on every price input in the app.
export function pricePlaceholder(lang) {
  return lang === 'de' ? 'z.B. 4,80 oder 4.80' : 'e.g. 4.80 or 4,80';
}
