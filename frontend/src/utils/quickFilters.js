// The one-tap filter chips under the map. Each is a patch onto the SAME `filters`
// object the full filter panel edits (so the two can never disagree); "active"
// is derived from that object, never stored separately.
//
//   ≤ €4  -> max_price 4.00      Biergarten -> type beer_garden
//   ≤ €5  -> max_price 5.00      Wirtshaus  -> type beer_hall
//   Vom Fass -> serve_type tap
//
// "Jetzt geöffnet" is deliberately NOT here: the app has no reliable opening-hours
// data, so it is shown disabled as "coming soon" instead of pretending to work.

export const QUICK_FILTERS = [
  { id: 'max4', patch: { max_price: '4.00' }, isActive: (f) => Number.parseFloat(f.max_price) === 4 },
  { id: 'max5', patch: { max_price: '5.00' }, isActive: (f) => Number.parseFloat(f.max_price) === 5 },
  { id: 'garden', patch: { type: 'beer_garden' }, isActive: (f) => f.type === 'beer_garden' },
  { id: 'hall', patch: { type: 'beer_hall' }, isActive: (f) => f.type === 'beer_hall' },
  { id: 'tap', patch: { serve_type: 'tap' }, isActive: (f) => f.serve_type === 'tap' },
];

const EMPTY = { type: '', brand: '', serve_type: '', neighbourhood: '', min_price: '', max_price: '' };
export const emptyFilters = () => ({ ...EMPTY });

// Turning a chip on applies its patch; turning it off clears exactly the fields it set.
export function toggleQuickFilter(filters, id) {
  const q = QUICK_FILTERS.find((x) => x.id === id);
  if (!q) return filters;
  if (q.isActive(filters)) {
    const cleared = Object.fromEntries(Object.keys(q.patch).map((k) => [k, '']));
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
  if (filters.serve_type && filters.serve_type !== 'tap') extras.push({ id: 'serve_type', clear: { serve_type: '' }, value: filters.serve_type });
  if (filters.min_price) extras.push({ id: 'min_price', clear: { min_price: '' }, value: filters.min_price });
  const max = Number.parseFloat(filters.max_price);
  if (filters.max_price && max !== 4 && max !== 5) extras.push({ id: 'max_price', clear: { max_price: '' }, value: filters.max_price });
  return extras;
}

export const countActiveFilters = (filters) =>
  [filters.type, filters.brand, filters.serve_type, filters.neighbourhood, filters.min_price, filters.max_price].filter(Boolean).length;
