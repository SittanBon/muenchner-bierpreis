// Shared price parsing/formatting so every price input and display in the app
// agrees on the same rule: accept German (comma) or English (dot) decimals on
// input, store as a plain number, and render back in whichever format matches
// the current UI language.

// "4,80" or "4.80" (or "4") -> 4.8. Returns null if the input isn't a valid price.
export function parsePrice(input) {
  if (input == null) return null;
  const cleaned = String(input).trim().replace(',', '.');
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

// value -> "4,80" (de) or "4.80" (en). Returns an em dash for null/NaN so
// callers don't need their own fallback.
export function formatPrice(value, lang) {
  if (value == null || Number.isNaN(value)) return '—';
  const fixed = Number(value).toFixed(2);
  return lang === 'de' ? fixed.replace('.', ',') : fixed;
}

// Same as formatPrice, with the € sign — the common case everywhere in the UI.
export function formatEuro(value, lang) {
  if (value == null || Number.isNaN(value)) return '—';
  return `€${formatPrice(value, lang)}`;
}

// Bilingual placeholder shown on every price input in the app.
export function pricePlaceholder(lang) {
  return lang === 'de' ? 'z.B. 4,80 oder 4.80' : 'e.g. 4.80 or 4,80';
}
