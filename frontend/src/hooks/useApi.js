// In production the frontend is served by the same Node process as the API, so
// same-origin relative /api requests just work with no URL needed. VITE_API_URL
// is only for pointing at a separately-hosted API (e.g. local dev against a
// deployed backend).
const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + '/api'
  : '/api';

// Always hit the live database — never let the browser serve a cached response.
const GET = (url) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

// Authenticated admin requests: a stale/expired JWT (server restarted with a new
// JWT_SECRET, or the 8h expiry passed while the token sat in localStorage) makes
// the API return `{ error }` instead of the array/object shape the caller expects.
// Throwing on a non-OK response lets AdminPage's existing `.catch` log the user
// out cleanly instead of crashing on `.map`/`.filter` of an error object.
async function authedFetch(url, options) {
  const r = await fetch(url, { cache: 'no-store', ...options });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}

export async function fetchNeighbourhoods() {
  return GET(`${BASE}/neighbourhoods`);
}

export async function fetchStats() {
  return GET(`${BASE}/stats`);
}

export async function fetchTrends() {
  return GET(`${BASE}/stats/trends`);
}

export async function fetchVenues(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return GET(`${BASE}/venues?${params}`);
}

export async function fetchVenue(id) {
  return GET(`${BASE}/venues/${id}`);
}

export async function submitPrice(data) {
  const r = await fetch(`${BASE}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const body = await r.json().catch(() => ({}));
  // A 4xx/5xx here means the submission was NOT saved (e.g. missing fields, a
  // stale venue_id) — surface that as a rejected promise so the form shows an
  // error instead of silently reporting success and closing.
  if (!r.ok) throw new Error(body.error || 'Submission failed');
  return body;
}

export async function adminLogin(username, password) {
  const r = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return r.json();
}

export async function adminFetchSubmissions(token, status) {
  const params = status ? `?status=${status}` : '';
  return authedFetch(`${BASE}/admin/submissions${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function adminUpdateSubmission(token, id, status, reject_reason) {
  return authedFetch(`${BASE}/admin/submissions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, reject_reason })
  });
}

export async function adminFetchStats(token) {
  return authedFetch(`${BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function adminCreateVenue(token, venue) {
  return authedFetch(`${BASE}/admin/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(venue)
  });
}

export async function adminAddBeer(token, venueId, beer) {
  return authedFetch(`${BASE}/admin/venues/${venueId}/beers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(beer)
  });
}

export async function adminUpdateBeerPrice(token, venueId, beerId, data) {
  return authedFetch(`${BASE}/admin/venues/${venueId}/beers/${beerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
}

export async function adminDeleteBeer(token, venueId, beerId) {
  return authedFetch(`${BASE}/admin/venues/${venueId}/beers/${beerId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

// The unified "📢 Report" button on a venue — price_change, new_beer, closed,
// other_info all go through here with a `report_type`.
export async function submitReport(data) {
  const r = await fetch(`${BASE}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Submission failed');
  return body;
}

// The "🍺 Missing a bar?" flow — multipart because a photo is optional.
export async function submitNewVenue(formData) {
  const r = await fetch(`${BASE}/submissions/new-venue`, {
    method: 'POST',
    body: formData
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Submission failed');
  return body;
}

// OpenStreetMap Nominatim — free geocoding, no API key. Bounded to Munich so
// "Ory Bar" doesn't come back with a result in another city.
const MUNICH_VIEWBOX = '11.36,48.25,11.72,48.06'; // left,top,right,bottom
export async function searchNominatim(query) {
  const params = new URLSearchParams({
    q: query, format: 'json', limit: '6', addressdetails: '1',
    countrycodes: 'de', viewbox: MUNICH_VIEWBOX, bounded: '1',
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!r.ok) throw new Error('Nominatim search failed');
  return r.json();
}
