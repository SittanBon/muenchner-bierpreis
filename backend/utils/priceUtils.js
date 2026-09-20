// Authoritative price/serving-size/freshness rules for the backend. The
// frontend keeps a mirror of the normalisation + formatting helpers in
// frontend/src/utils/priceUtils.js and of the freshness rules in
// frontend/src/utils/freshness.js — backend/priceUtilsParity.test.js runs both
// implementations against the same cases so the two can never drift apart.
//
// Why the pieces below exist (P0 spec Parts B–D):
//   * `beers.updated` is a TECHNICAL modification date. It must never be read
//     as evidence that a price is current — an unrelated edit (a spelling fix,
//     a serve-type change) would otherwise make an old price look brand new.
//   * A price's age comes only from `verified_at` (someone confirmed it is
//     still correct) or `price_observed_at` (when it was actually seen /
//     reported). Neither set → UNKNOWN. Never invent a date.
//   * A price is only comparable across venues once it is normalised to a
//     common serving size (0.5 L) — and only when the serving size is known.

// ─── Serving sizes ──────────────────────────────────────────────────────────

// Sizes a submission may name → ml. Anything else is rejected/ignored.
const SIZE_TO_ML = { '0.25L': 250, '0.33L': 330, '0.4L': 400, '0.5L': 500, '1L': 1000 };
const VALID_SIZES = Object.keys(SIZE_TO_ML);
const VALID_VOLUMES_ML = Object.values(SIZE_TO_ML);
const REFERENCE_VOLUME_ML = 500; // every comparison price is "per 0.5 L"

function volumeFromSize(size) {
  return typeof size === 'string' && Object.prototype.hasOwnProperty.call(SIZE_TO_ML, size)
    ? SIZE_TO_ML[size]
    : null;
}

function isValidSize(size) {
  return volumeFromSize(size) !== null;
}

function isValidVolume(ml) {
  return Number.isInteger(ml) && VALID_VOLUMES_ML.includes(ml);
}

// 500 -> "0.5L" (en) / "0,5L" (de); 1000 -> "1L"; unknown -> null.
function formatVolume(ml, lang) {
  if (!isValidVolume(ml)) return null;
  const s = `${ml / 1000}L`;
  return lang === 'de' ? s.replace('.', ',') : s;
}

// ─── Normalised 0.5 L price ─────────────────────────────────────────────────

// actual price / serving volume × 500 ml, rounded to cents. Returns null (not 0,
// not the raw price) whenever either input is missing or nonsensical, so a
// caller can never accidentally present an unknown-size price as a fair 0.5 L
// comparison. e.g. €3.50 for 330 ml -> €5.30 per 0.5 L.
function normalizePrice(actualPrice, volumeMl) {
  const price = Number(actualPrice);
  const volume = Number(volumeMl);
  if (!Number.isFinite(price) || !Number.isFinite(volume) || price <= 0 || volume <= 0) return null;
  return Math.round((price / volume * REFERENCE_VOLUME_ML) * 100) / 100;
}

// "€4,80" (de) / "€4.80" (en). null/NaN -> "—" so callers need no fallback.
function formatPrice(price, lang) {
  if (price == null || Number.isNaN(Number(price))) return '—';
  const fixed = Number(price).toFixed(2);
  return lang === 'de' ? '€' + fixed.replace('.', ',') : '€' + fixed;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

// Today's calendar date in Munich (YYYY-MM-DD). The server may run in UTC; a
// "verified today" stamped at 00:30 Munich time must not land on yesterday.
const berlinDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});
function todayISO(now = new Date()) {
  return berlinDate.format(now);
}

// Leading YYYY-MM-DD of a stored value (a date, or a future full timestamp),
// or null when it isn't one — and null for dates the calendar doesn't have.
function toDateOnly(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(`${m[0]}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m[0] ? m[0] : null;
}

// A user-supplied visit date: must be a real calendar date and not in the
// future. It becomes price_observed_at when a submission is approved, so a
// made-up or future date would directly forge a price's freshness.
function validateVisitDate(value, now = new Date()) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? toDateOnly(value) : null;
  if (!date) return { ok: false, error: 'Invalid visit_date' };
  if (date > todayISO(now)) return { ok: false, error: 'visit_date cannot be in the future' };
  return { ok: true, value: date };
}

function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}

// ─── Freshness ──────────────────────────────────────────────────────────────

// Thresholds live here only (P0 spec Part D: "configurable centrally").
const FRESH_DAYS = 30;  // FRESH = observed/verified within the last 30 days
const AGING_DAYS = 90;  // AGING = 31-90 days, STALE = more than 90

// { state, basis, date, days } for one beer. Reads ONLY verified_at, then
// price_observed_at — never `updated`, however recent it is. A missing,
// malformed or future date means there is no reliable timestamp: UNKNOWN.
function getFreshness(beer, now = new Date()) {
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

// What to store in verified_at / price_observed_at when a price is recorded
// (an approved submission, or an admin entering/changing a price).
//   - The price or serving size CHANGED: the new value was observed at
//     `observedAt`, and any earlier verification was of the OLD value, so it
//     is cleared. Never carry an old date over to a new price.
//   - Same value seen again: only move forward. A newer observation replaces
//     an older one; an older verification it supersedes is cleared so that
//     freshness (which prefers verified_at) reflects the newest evidence.
function resolveObservationDates({ existing, newPrice, newVolume, observedAt }) {
  const observed = toDateOnly(observedAt);
  const current = {
    price_observed_at: toDateOnly(existing?.price_observed_at),
    verified_at: toDateOnly(existing?.verified_at),
  };
  if (!observed) return current;

  const changed = Number(existing?.size_05) !== Number(newPrice)
    || (existing?.serving_volume_ml ?? null) !== (newVolume ?? null);
  if (changed) return { price_observed_at: observed, verified_at: null };

  const next = { ...current };
  if (!next.price_observed_at || observed > next.price_observed_at) {
    next.price_observed_at = observed;
    if (next.verified_at && next.verified_at <= observed) next.verified_at = null;
  }
  return next;
}

module.exports = {
  SIZE_TO_ML,
  VALID_SIZES,
  VALID_VOLUMES_ML,
  REFERENCE_VOLUME_ML,
  FRESH_DAYS,
  AGING_DAYS,
  volumeFromSize,
  isValidSize,
  isValidVolume,
  formatVolume,
  normalizePrice,
  formatPrice,
  todayISO,
  toDateOnly,
  validateVisitDate,
  getFreshness,
  resolveObservationDates,
};
