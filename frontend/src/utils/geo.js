// Distance + "cheap beer nearby" logic. Pure functions — the browser's
// geolocation itself lives in hooks/useNearby.js.

export const NEARBY_RADIUS_M = 1000; // "Günstiges Bier in der Nähe" looks 1 km around the user
const EARTH_RADIUS_M = 6371000;
const rad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in metres between two { lat, lng } points (haversine).
export function distanceMeters(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "450 m" below a kilometre (rounded to 10 m — GPS is not that exact), "1.2 km"
// (en) / "1,2 km" (de) above. Unknown / invalid -> null, so a caller can never
// print a made-up distance.
export function formatDistance(meters, lang) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = (Math.round(meters / 100) / 10).toFixed(1);
  return `${lang === 'de' ? km.replace('.', ',') : km} km`;
}

// The price a venue is ranked by: its headline beer's per-0.5 L comparison price.
// A venue whose serving size is unknown has none, and sorts after every comparable one.
export const comparablePrice = (venue) => venue?.beers?.[0]?.normalized_500ml_price ?? Infinity;

// Venues within `radius` metres of `coords`, each with its `distance_m`, cheapest
// first (tie: nearer first). A venue without coordinates can't be placed, so it is
// never "nearby". Returns NEW objects; the input is not modified.
export function nearbyVenues(venues, coords, radius = NEARBY_RADIUS_M) {
  if (!coords) return [];
  return venues
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map((v) => ({ ...v, distance_m: distanceMeters(coords, { lat: v.lat, lng: v.lng }) }))
    .filter((v) => v.distance_m <= radius)
    .sort((a, b) => (comparablePrice(a) - comparablePrice(b)) || (a.distance_m - b.distance_m));
}

// Is a venue inside a map's visible bounds { south, west, north, east }? A venue without
// coordinates can't be placed, so it is never "in the area".
export function inBounds(venue, b) {
  if (!b || !Number.isFinite(venue?.lat) || !Number.isFinite(venue?.lng)) return false;
  return venue.lat >= b.south && venue.lat <= b.north && venue.lng >= b.west && venue.lng <= b.east;
}
