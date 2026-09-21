// The one-tap filter chips under the map. Each is a patch onto the SAME `filters`
// object the full filter panel edits (so the two can never disagree); "active"
// is derived from that object, never stored separately.
//
//   ≤ €4  -> max_price 4.00      Biergarten -> type beer_garden
//   ≤ €5  -> max_price 5.00      Wirtshaus  -> type beer_hall
//   Vom Fass -> serve_type tap
//
// "Jetzt geöffnet" (open_now) is a CLIENT-side filter: it keeps only venues whose stored
// opening hours can be read AND say they are open right now (utils/openingHours.js).
// A venue whose hours are missing/unreadable is never shown as open. It is only offered
// when at least one venue has readable hours (App decides) — otherwise it stays "Demnächst".

import { SERVE_TAP } from '../constants/serveTypes';

export const QUICK_FILTERS = [
  { id: 'max4', patch: { max_price: '4.00' }, isActive: (f) => Number.parseFloat(f.max_price) === 4 },
  { id: 'max5', patch: { max_price: '5.00' }, isActive: (f) => Number.parseFloat(f.max_price) === 5 },
  { id: 'garden', patch: { type: 'beer_garden' }, isActive: (f) => f.type === 'beer_garden' },
  { id: 'hall', patch: { type: 'beer_hall' }, isActive: (f) => f.type === 'beer_hall' },
  { id: 'tap', patch: { serve_type: SERVE_TAP }, isActive: (f) => f.serve_type === SERVE_TAP },
];
// Not in QUICK_FILTERS (it has its own availability rule and chip) but part of `filters`.
export const OPEN_NOW_CHIP = { id: 'open', patch: { open_now: true }, isActive: (f) => !!f.open_now };

const EMPTY = { type: '', brand: '', serve_type: '', neighbourhood: '', min_price: '', max_price: '', open_now: false };
export const emptyFilters = () => ({ ...EMPTY });

// Turning a chip on applies its patch; turning it off clears exactly the fields it set.
export function toggleQuickFilter(filters, id) {
  const q = [...QUICK_FILTERS, OPEN_NOW_CHIP].find((x) => x.id === id);
  if (!q) return filters;
  if (q.isActive(filters)) {
    const cleared = Object.fromEntries(Object.entries(q.patch).map(([k, v]) => [k, typeof v === 'boolean' ? false : '']));
    return { ...filters, ...cleared };
  }
  return { ...filters, ...q.patch };
}

// Active filters that NO quick chip shows (a brand, a neighbourhood, a minimum price,
// a venue type like "bar", a custom maximum…). The chip row lists these as removable
// chips too, so a filter set in the full panel is never invisible.
export function extraActiveFilters(filters) {
  const quickTypes = ['beer_garden', 'beer_hall'];
  const extras = [];
  if (filters.brand) extras.push({ id: 'brand', clear: { brand: '' }, value: filters.brand });
  if (filters.neighbourhood) extras.push({ id: 'neighbourhood', clear: { neighbourhood: '' }, value: filters.neighbourhood });
  if (filters.type && !quickTypes.includes(filters.type)) extras.push({ id: 'type', clear: { type: '' }, value: filters.type });
  if (filters.serve_type && filters.serve_type !== SERVE_TAP) extras.push({ id: 'serve_type', clear: { serve_type: '' }, value: filters.serve_type });
  if (filters.min_price) extras.push({ id: 'min_price', clear: { min_price: '' }, value: filters.min_price });
  const max = Number.parseFloat(filters.max_price);
  if (filters.max_price && max !== 4 && max !== 5) extras.push({ id: 'max_price', clear: { max_price: '' }, value: filters.max_price });
  return extras;
}

// How many filters are active — what the "Mehr (2)" badge shows. A price range (min and/or
// max) is ONE filter, however many of its two fields are set.
export const countActiveFilters = (filters) =>
  [filters.type, filters.brand, filters.serve_type, filters.neighbourhood, filters.min_price || filters.max_price, filters.open_now]
    .filter(Boolean).length;
