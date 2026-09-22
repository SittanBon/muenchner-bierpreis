// Display metadata + search vocabulary for the admin data-quality flags. The
// flags themselves are computed on the server (backend/dataQuality.js) and
// arrive as codes; this only says how to label, colour and search for them.
// A code the frontend doesn't know still renders (as its raw code) instead of
// breaking the tab, so a new server-side flag can ship without a lockstep deploy.

// severity -> badge colour class (`dq-badge-<severity>`); the text label is
// always shown too, so a flag is never conveyed by colour alone.
export const FLAG_SEVERITY = {
  MISSING_PRICE: 'high',
  INVALID_PRICE: 'high',
  VENUE_WITHOUT_ACTIVE_PRICE: 'high',
  EXTREME_NORMALIZED_PRICE: 'high',
  STALE_PRICE: 'medium',
  MISSING_SERVING_SIZE: 'medium',
  DUPLICATE_VENUE: 'medium',
  MISSING_OBSERVATION_DATE: 'low',
  ASSUMED_HALF_LITRE: 'low',
};

// Display order for the filter chips (worst first).
export const FLAG_ORDER = [
  'MISSING_PRICE', 'INVALID_PRICE', 'VENUE_WITHOUT_ACTIVE_PRICE', 'EXTREME_NORMALIZED_PRICE',
  'STALE_PRICE', 'MISSING_SERVING_SIZE', 'DUPLICATE_VENUE', 'MISSING_OBSERVATION_DATE', 'ASSUMED_HALF_LITRE',
];

// Extra words that find a flag in the admin search, on top of its code
// ("stale_price" / "stale price"). English and German, since the admin UI is
// bilingual.
export const FLAG_ALIASES = {
  MISSING_PRICE: ['no price', 'preis fehlt', 'kein preis'],
  INVALID_PRICE: ['bad price', 'implausible', 'ungültiger preis'],
  VENUE_WITHOUT_ACTIVE_PRICE: ['no active price', 'no price at all', 'ohne preis'],
  EXTREME_NORMALIZED_PRICE: ['extreme', 'too expensive', 'zu teuer'],
  STALE_PRICE: ['stale', 'outdated', 'old price', 'veraltet'],
  MISSING_SERVING_SIZE: ['no size', 'size missing', 'größe fehlt', 'groesse fehlt', 'unknown size'],
  DUPLICATE_VENUE: ['duplicate', 'dupe', 'doppelt'],
  MISSING_OBSERVATION_DATE: ['no date', 'date unknown', 'unverified', 'datum unbekannt', 'never verified'],
  ASSUMED_HALF_LITRE: ['assumed', 'unconfirmed size', 'größe unbestätigt', 'groesse unbestaetigt', 'needs review'],
};

export function flagSeverity(code) {
  return FLAG_SEVERITY[code] || 'low';
}

// Lower-case search terms for one flag code.
export function flagSearchTerms(code) {
  const lower = String(code).toLowerCase();
  return [lower, lower.replace(/_/g, ' '), ...(FLAG_ALIASES[code] || [])];
}
