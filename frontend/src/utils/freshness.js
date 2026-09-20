// Price freshness (P0 spec Part D). A price's age comes ONLY from:
//   1. verified_at        — someone confirmed the price is still correct, else
//   2. price_observed_at  — when the price was actually seen / reported.
// The technical `updated` column is NEVER read here: it moves whenever a record
// is edited for any reason, so it says nothing about how current a price is.
// No usable date -> UNKNOWN ("Datum unbekannt") — never "fresh".
//
// backend/utils/priceUtils.js implements the same rules for the API's
// `freshness_state`; backend/priceUtilsParity.test.js keeps the two in step.

// Thresholds (days since the verification/observation date):
//   FRESH  <= FRESH_DAYS   AGING  FRESH_DAYS+1 .. AGING_DAYS   STALE  > AGING_DAYS
export const FRESH_DAYS = 30;
export const AGING_DAYS = 90;

// Today's calendar date in Munich (YYYY-MM-DD) — same convention as the backend.
const berlinDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function todayISO(now = new Date()) {
  return berlinDate.format(now);
}

// Leading YYYY-MM-DD of a stored value, or null if it isn't a real calendar date.
export function toDateOnly(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(`${m[0]}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m[0] ? m[0] : null;
}

function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}

// { state: 'FRESH'|'AGING'|'STALE'|'UNKNOWN', basis: 'verified'|'observed'|null,
//   date, days } for one beer. A missing, malformed or future date is UNKNOWN.
export function getFreshness(beer, now = new Date()) {
  const verified = toDateOnly(beer?.verified_at);
  const observed = toDateOnly(beer?.price_observed_at);
  const date = verified || observed;
  const unknown = { state: 'UNKNOWN', basis: null, date: null, days: null };
  if (!date) return unknown;
  const days = daysBetween(date, todayISO(now));
  if (days < 0) return unknown;
  const state = days <= FRESH_DAYS ? 'FRESH' : days <= AGING_DAYS ? 'AGING' : 'STALE';
  return { state, basis: verified ? 'verified' : 'observed', date, days };
}

// Dot colours. Colour is never the only signal: every non-compact view also
// renders the text label, and the compact dot carries it as title/aria-label.
export const FRESHNESS_COLORS = {
  FRESH: '#3a9d3a',
  AGING: '#d9a300',
  STALE: '#c8442c',
  UNKNOWN: '#8a8a8a',
};

// i18n key (+ plural `count`) for the visible text. Wording follows the data:
// only a real verification says "Bestätigt / Verified"; a fresh price that was
// merely observed/reported says "Aktualisiert / Updated" — it must not imply
// stronger verification than exists. AGING and STALE share one message.
export function freshnessText(f) {
  if (f.state === 'UNKNOWN') return { key: 'freshness.unknown' };
  if (f.state === 'AGING' || f.state === 'STALE') return { key: 'freshness.maybeOutdated' };
  const kind = f.basis === 'verified' ? 'verified' : 'observed';
  if (f.days === 0) return { key: `freshness.${kind}Today` };
  return { key: `freshness.${kind}DaysAgo`, count: f.days };
}
