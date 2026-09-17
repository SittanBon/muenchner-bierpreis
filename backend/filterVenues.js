// Pure, framework-independent venue filtering — used by GET /api/venues (see
// server.js) and directly unit-tested (see filterVenues.test.js) with no
// running server or database needed. Centralizing the predicate here, in one
// place, is what guarantees the venue list, map markers and result count can
// never drift out of sync: every consumer filters the exact same array with
// the exact same logic, instead of each reimplementing its own version.

const TYPE_SEARCH_TERMS = {
  beer_garden: ['biergarten', 'beer garden', 'garden'],
  beer_hall: ['wirtshaus', 'bierhalle', 'bierhaus', 'beer hall', 'inn'],
  bar: ['bar', 'kneipe'],
  restaurant: ['restaurant', 'gaststätte', 'gaststaette'],
};

// Every string a free-text query (`q`) is matched against, lower-cased.
function venueSearchHaystack(v) {
  return [
    v.name,
    v.address,
    v.neighbourhood_id,
    v.neighbourhood_name_de,
    v.neighbourhood_name_en,
    ...v.beers.map((b) => b.brand),
    ...(TYPE_SEARCH_TERMS[v.type] || [v.type]),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
}

// A blank string, missing value, or non-numeric garbage must never become a
// 0/NaN constraint that silently filters out every venue — all three are
// treated as "no bound provided" rather than "bound is zero".
function parsePriceBound(raw) {
  if (raw == null || raw === '') return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

const SERVE_TYPES = ['tap', 'bottle', 'can', 'unknown'];

// query: { neighbourhood, type, brand, serve_type, min_price, max_price, q } —
// every key optional. Price bounds are inclusive on both ends.
function filterVenues(venues, query = {}) {
  const { neighbourhood, type, brand, serve_type, min_price, max_price, q } = query;
  let result = venues;

  if (neighbourhood) result = result.filter((v) => v.neighbourhood_id === neighbourhood);
  if (type) result = result.filter((v) => v.type === type);
  if (brand) {
    const bl = String(brand).toLowerCase();
    result = result.filter((v) => v.beers.some((b) => b.brand.toLowerCase().includes(bl)));
  }
  // Matches on ANY of the venue's beers, not just the headline (cheapest)
  // one — a venue listing both a tap and a bottled brand should still show
  // up under "Tap" for that first beer even if a cheaper bottled one sorts
  // first. Unrecognised values behave like "no filter" rather than matching
  // nothing, same NaN-safety spirit as parsePriceBound below.
  if (serve_type && SERVE_TYPES.includes(serve_type)) {
    result = result.filter((v) => v.beers.some((b) => b.serve_type === serve_type));
  }

  const min = parsePriceBound(min_price);
  const max = parsePriceBound(max_price);
  if (min != null) result = result.filter((v) => v.beers[0] && v.beers[0].size_05 >= min);
  if (max != null) result = result.filter((v) => v.beers[0] && v.beers[0].size_05 <= max);

  if (q && String(q).trim()) {
    const ql = String(q).trim().toLowerCase();
    result = result.filter((v) => venueSearchHaystack(v).some((s) => s.includes(ql)));
  }

  return result;
}

module.exports = { filterVenues, venueSearchHaystack, parsePriceBound, TYPE_SEARCH_TERMS, SERVE_TYPES };
