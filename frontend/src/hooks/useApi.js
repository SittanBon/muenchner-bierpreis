const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Always hit the live database — never let the browser serve a cached response.
const GET = (url) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

export async function fetchNeighbourhoods() {
  return GET(`${BASE}/neighbourhoods`);
}

export async function fetchStats() {
  return GET(`${BASE}/stats`);
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
  return r.json();
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
  const r = await fetch(`${BASE}/admin/submissions${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.json();
}

export async function adminUpdateSubmission(token, id, status) {
  const r = await fetch(`${BASE}/admin/submissions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status })
  });
  return r.json();
}

export async function adminFetchStats(token) {
  const r = await fetch(`${BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.json();
}
