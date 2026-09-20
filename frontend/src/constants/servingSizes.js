// THE list of serving sizes. Every size <select>, label and validation on the
// frontend reads from here — never a hardcoded "0,5L"/"Maß" string. The backend
// keeps its own copy (backend/utils/priceUtils.js: SIZE_TO_ML) because it cannot
// import ESM; backend/priceUtilsParity.test.js fails if the two ever differ.
//
//   ml       serving volume in millilitres — what is stored (beers.serving_volume_ml)
//   label    canonical display label
//   size     the wire value the submissions API accepts/stores ('0.4L', not
//            '0.40L') — kept so existing rows and clients stay valid
//   name_*   the local name a drinker knows the size by
export const SERVING_SIZES = [
  { ml: 250, label: '0.25L', size: '0.25L', name_de: 'Kleines', name_en: 'Small' },
  { ml: 330, label: '0.33L', size: '0.33L', name_de: 'Flasche', name_en: 'Bottle' },
  { ml: 400, label: '0.40L', size: '0.4L', name_de: 'Kleines Helles', name_en: 'Small Helles' },
  { ml: 500, label: '0.50L', size: '0.5L', name_de: 'Halbe', name_en: 'Half litre' },
  { ml: 1000, label: '1.00L', size: '1L', name_de: 'Maß', name_en: 'Full litre' },
];

export const VALID_VOLUMES_ML = SERVING_SIZES.map((s) => s.ml);
export const REFERENCE_VOLUME_ML = 500; // every comparison price is "per 0.5 L"
export const DEFAULT_SERVING_ML = 500;  // what a "the 0.5 L price" form field means

export const servingSizeByMl = (ml) => SERVING_SIZES.find((s) => s.ml === Number(ml)) || null;
export const servingSizeByWire = (size) => SERVING_SIZES.find((s) => s.size === size) || null;
// A size's API wire value from its ml ('0.4L' for 400), or null.
export const wireSizeFromMl = (ml) => servingSizeByMl(ml)?.size ?? null;

// "0.50L" (en) / "0,50L" (de) — the canonical label with the decimal separator
// of the UI language. Unknown volume -> null.
export function servingLabel(ml, lang) {
  const s = servingSizeByMl(ml);
  if (!s) return null;
  return lang === 'de' ? s.label.replace('.', ',') : s.label;
}

// The <option> text for a size dropdown: "0.50L — Halbe (500ml)".
export function servingOptionText(ml, lang) {
  const s = servingSizeByMl(ml);
  if (!s) return '';
  return `${servingLabel(ml, lang)} — ${lang === 'de' ? s.name_de : s.name_en} (${s.ml}ml)`;
}
