// Sorting for the venue LIST (the map's markers have no order). Pure and stable: equal
// keys fall back to the venue name, so the order never flickers between renders.
import { getFreshness } from './freshness';
import { comparablePrice } from './geo';

export const SORT_OPTIONS = ['price_asc', 'price_desc', 'name', 'distance', 'freshness'];
export const DEFAULT_SORT = 'price_asc';

const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' });
// An unknown value never leads: it sorts after every known one, in either direction.
const finiteOrNull = (n) => (Number.isFinite(n) ? n : null);
function cmpNullsLast(a, b, dir) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir * (a - b);
}

// The date a venue's headline price is "as fresh as": verified_at if set, else
// price_observed_at (the same rule the freshness text uses) — never `updated`.
export function freshnessDate(venue, now = new Date()) {
  const beer = venue.beers?.[0];
  return beer ? getFreshness(beer, now).date || null : null;
}

// `distance` needs each venue's `distance_m` (present when the user shared a location);
// without it every venue is "unknown" and the order falls back to the name.
export function sortVenues(venues, key = DEFAULT_SORT, now = new Date()) {
  const list = [...venues];
  const price = (v) => finiteOrNull(comparablePrice(v));
  switch (key) {
    case 'price_desc':
      return list.sort((a, b) => cmpNullsLast(price(a), price(b), -1) || byName(a, b));
    case 'name':
      return list.sort(byName);
    case 'distance':
      return list.sort((a, b) => cmpNullsLast(finiteOrNull(a.distance_m), finiteOrNull(b.distance_m), 1) || byName(a, b));
    case 'freshness':
      // ISO dates compare as strings; newest first, unknown last.
      return list.sort((a, b) => {
        const da = freshnessDate(a, now); const db = freshnessDate(b, now);
        if (da === db) return byName(a, b);
        if (da === null) return 1;
        if (db === null) return -1;
        return db.localeCompare(da) || byName(a, b);
      });
    case 'price_asc':
    default:
      return list.sort((a, b) => cmpNullsLast(price(a), price(b), 1) || byName(a, b));
  }
}
