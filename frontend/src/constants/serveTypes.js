// THE list of serve types a beer can be poured as. Every serve-type <select>, tag, chip
// and filter reads this — never a hand-typed emoji or "Vom Fass". The backend keeps its
// own copy (SERVE_TYPES in backend/db/database.js, which also allows 'unknown');
// backend/priceUtilsParity.test.js fails if they ever differ.
//
// 'unknown' is deliberately NOT in this list: it is not a serve type but the absence of
// an answer. Where a KNOWN type is shown (tags, list cards, the venue sheet) an unknown
// one is simply omitted; a form that asks the question adds its own "Weiß nicht" option.
export const SERVE_TYPES = [
  { value: 'tap', label_de: 'Vom Fass', label_en: 'On Tap', icon: '🍺' },
  { value: 'bottle', label_de: 'Flasche', label_en: 'Bottle', icon: '🍾' },
  { value: 'can', label_de: 'Dose', label_en: 'Can', icon: '🥫' },
];
export const UNKNOWN_SERVE_TYPE = 'unknown';
export const SERVE_TAP = 'tap'; // the "Vom Fass" quick filter

export const serveTypeByValue = (value) => SERVE_TYPES.find((s) => s.value === value) || null;
export const isKnownServeType = (value) => serveTypeByValue(value) !== null;
export const serveTypeLabel = (value, lang) => {
  const s = serveTypeByValue(value);
  return s ? (lang === 'de' ? s.label_de : s.label_en) : null;
};
// "🍺 Vom Fass" — icon + label; null for an unknown type (so nothing is rendered).
export const serveTypeText = (value, lang) => {
  const s = serveTypeByValue(value);
  return s ? `${s.icon} ${serveTypeLabel(value, lang)}` : null;
};
