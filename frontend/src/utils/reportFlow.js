// The rules of the report flow, as pure functions: what a form starts with, whether it may be
// sent, and exactly what is sent. The UI (components/ReportForm.jsx) only renders this.
import { parsePrice } from './price';
import { todayISO, toDateOnly } from './freshness';
import { isValidVolume } from './priceUtils';
import { DEFAULT_SERVING_ML, wireSizeFromMl } from '../constants/servingSizes';
import { NOTE_MAX, PRICE_MIN, PRICE_MAX, WRONG_FIELDS } from '../constants/reportOptions';

export { NOTE_MAX, PRICE_MIN, PRICE_MAX, WRONG_FIELDS };
export const TOPICS = [
  { key: 'price_change', icon: '💶' },
  { key: 'new_beer', icon: '🍺' },
  { key: 'closed', icon: '🔒' },
  { key: 'other_info', icon: 'ℹ️' },
];
export const PRICE_TOPICS = ['price_change', 'new_beer'];

const sameBrand = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// The venue's beer for a brand the user typed/picked, or null.
export function beerForBrand(venue, brand) {
  if (!brand || !String(brand).trim()) return null;
  return (venue?.beers || []).find((b) => sameBrand(b.brand, brand)) || null;
}

// A known serving size of a beer, or '' (unknown — the form then makes the user choose;
// 0.5 L is never assumed for a price we know nothing about).
export const knownSizeMl = (beer) => (isValidVolume(beer?.serving_volume_ml) ? beer.serving_volume_ml : '');

// What "Preis hat sich geändert" / "Preis falsch? → Korrigieren" starts with:
//  * the brand — only when the venue lists exactly ONE brand (with several, the user picks);
//  * the serving size — of that single beer, or (several brands) of the headline beer the
//    correction link sits under; '' when that size is unknown.
export function prefillFromVenue(venue) {
  const beers = venue?.beers || [];
  const brand = beers.length === 1 ? beers[0].brand : '';
  return { brand, sizeMl: knownSizeMl(beers[0]) };
}

// The starting values of the price form for a topic. "Anderes Bier" starts blank (a new beer
// has no known brand/size), on the usual 0.5 L; a price correction is pre-filled.
export function initialPriceForm(venue, topic) {
  if (topic === 'new_beer') return { beer_brand: '', size_ml: DEFAULT_SERVING_ML };
  const p = prefillFromVenue(venue);
  return { beer_brand: p.brand, size_ml: p.sizeMl };
}

// Error keys (report.err*) or null. `today` is injectable for tests.
export function validateReport(topic, form, today = todayISO()) {
  if (PRICE_TOPICS.includes(topic)) {
    if (!String(form.beer_brand || '').trim()) return 'report.errBrand';
    if (!isValidVolume(Number(form.size_ml))) return 'report.errSize';
    const price = parsePrice(form.price);
    if (price == null) return 'report.errPrice';
    if (price < PRICE_MIN || price > PRICE_MAX) return 'report.errPriceRange';
    const date = toDateOnly(form.visit_date);
    if (!date || date > today) return 'report.errDate';
    return null;
  }
  if (topic === 'other_info' || topic === 'suggest_description') {
    const note = String(form.note || '').trim();
    if (!note) return 'report.errNote';
    if (note.length > NOTE_MAX) return 'report.errNoteLong';
    return null;
  }
  return null; // closed: nothing to fill in
}

// The request body for POST /api/submissions.
export function buildPayload(topic, venue, form) {
  const base = {
    report_type: topic,
    venue_id: venue.id,
    venue_name: venue.name,
    submitter_name: form.anonymous || !String(form.submitter_name || '').trim() ? 'Anonym' : String(form.submitter_name).trim(),
  };
  if (PRICE_TOPICS.includes(topic)) {
    return {
      ...base,
      beer_brand: String(form.beer_brand).trim(),
      size: wireSizeFromMl(Number(form.size_ml)),
      price: parsePrice(form.price),
      serve_type: form.serve_type || 'unknown',
      visit_date: form.visit_date,
    };
  }
  if (topic === 'other_info') {
    return { ...base, note: String(form.note).trim(), ...(form.wrong_field ? { wrong_field: form.wrong_field } : {}) };
  }
  if (topic === 'suggest_description') return { ...base, note: String(form.note).trim() };
  return { ...base, submitter_name: 'Anonym' }; // closed: one tap, nothing personal asked
}
