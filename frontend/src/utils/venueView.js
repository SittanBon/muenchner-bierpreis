// What the venue views (bottom sheet / desktop panel / list card) say about a venue —
// as pure functions, so the "never invent data" rules are unit-tested:
//   * a distance only when we really know where the user is;
//   * opening hours only as the text we hold — never an "open now" claim;
//   * a serving size only when it is known (else the caller shows "Größe unbekannt");
//   * a serve type only when known.
import { distanceMeters, formatDistance } from './geo';
import { servingSizeByMl } from '../constants/servingSizes';
import { formatVolume, isValidVolume } from './priceUtils';

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

// "0,50L · Halbe" (de) / "0.50L · Half litre" (en) for a beer's serving size, or
// null when the size is unknown — never a guess like "0.5 L".
export function sizeLine(beer, lang) {
  const ml = beer?.serving_volume_ml;
  if (!isValidVolume(ml)) return null;
  const size = servingSizeByMl(ml);
  return `${formatVolume(ml, lang)} · ${lang === 'de' ? size.name_de : size.name_en}`;
}

// Distance from the user to the venue as text ("320 m", "1,2 km"), or null when the
// user's position or the venue's coordinates are unknown. Never "0 m".
export function distanceText(user, venue, lang) {
  if (!user || !finite(user.lat) || !finite(user.lng)) return null;
  if (!venue || !finite(venue.lat) || !finite(venue.lng)) return null;
  return formatDistance(distanceMeters(user, { lat: venue.lat, lng: venue.lng }), lang);
}

// Opening hours exactly as stored (free text such as "Mo–So 9:00–23:30"), or null
// when there are none. The app has no structured hours, so it can never say
// "open now" — and a missing value is simply not shown.
export function hoursText(venue) {
  const h = typeof venue?.opening_hours === 'string' ? venue.opening_hours.trim() : '';
  return h || null;
}

// The serve type worth showing: 'tap' | 'bottle' | 'can', or null when unknown.
export function knownServeType(beer) {
  return ['tap', 'bottle', 'can'].includes(beer?.serve_type) ? beer.serve_type : null;
}

// Google Maps links. Directions opens turn-by-turn to the venue; reviews opens the
// place's Maps card (where its Google reviews are). The address is only appended
// when we have one — there used to be a literal "undefined" in this query.
export function mapsLinks(venue) {
  const q = encodeURIComponent([venue?.name, venue?.address].filter(Boolean).join(' '));
  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    reviews: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}
