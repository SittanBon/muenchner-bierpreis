// Tests for backend/utils/priceUtils.js — normalisation, serving sizes,
// visit-date validation, freshness and the observation-date write rules.
//   node --test backend/priceUtils.test.js
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  FRESH_DAYS, AGING_DAYS, VALID_VOLUMES_ML,
  normalizePrice, formatPrice, formatVolume, volumeFromSize, isValidSize, isValidVolume,
  todayISO, toDateOnly, validateVisitDate, getFreshness, resolveObservationDates,
} = require('./utils/priceUtils');

// A fixed "now" so freshness tests never depend on the real clock: noon UTC on
// 2026-09-20 (14:00 in Munich) — the same calendar day in both zones.
const NOW = new Date('2026-09-20T12:00:00Z');
// YYYY-MM-DD that is `n` days before NOW's date.
const daysAgo = (n) => new Date(Date.UTC(2026, 8, 20 - n)).toISOString().slice(0, 10);

describe('normalizePrice — per-0.5 L comparison price', () => {
  test('€3.50 for 330 ml -> €5.30', () => assert.equal(normalizePrice(3.5, 330), 5.3));
  test('€4.20 for 500 ml -> €4.20 (already 0.5 L)', () => assert.equal(normalizePrice(4.2, 500), 4.2));
  test('a true half-cent rounds UP, not down through floating-point noise (€2.90 @ 400 ml = 3.625 -> €3.63)', () => {
    assert.equal(normalizePrice(2.9, 400), 3.63);   // price / volume × 500 used to give 3.6249999… -> 3.62
    assert.equal(normalizePrice(9.15, 1000), 4.58);
    assert.equal(normalizePrice(1.15, 1000), 0.58);
    assert.equal(normalizePrice(3.3, 330), 5);      // and exact values are unaffected
  });
  test('null price -> null', () => assert.equal(normalizePrice(null, 500), null));
  test('undefined price -> null', () => assert.equal(normalizePrice(undefined, 500), null));
  test('zero volume -> null', () => assert.equal(normalizePrice(4.2, 0), null));
  test('null volume (unknown serving size) -> null, never the raw price', () => assert.equal(normalizePrice(4.2, null), null));
  test('zero price -> null', () => assert.equal(normalizePrice(0, 500), null));
  test('negative price / volume -> null', () => {
    assert.equal(normalizePrice(-3, 500), null);
    assert.equal(normalizePrice(3, -330), null);
  });
  test('NaN / non-numeric -> null', () => {
    assert.equal(normalizePrice(NaN, 500), null);
    assert.equal(normalizePrice('abc', 500), null);
    assert.equal(normalizePrice(4.2, 'abc'), null);
  });
  test('numeric strings are accepted', () => assert.equal(normalizePrice('4.2', '500'), 4.2));
  test('rounds to cents', () => {
    assert.equal(normalizePrice(4.0, 330), 6.06);   // 6.0606…
    assert.equal(normalizePrice(3.999, 500), 4.0);  // 3.999 -> 4.00
    assert.equal(normalizePrice(2.5, 250), 5.0);
    assert.equal(normalizePrice(9.2, 1000), 4.6);   // a Maß, per 0.5 L
    assert.equal(normalizePrice(3.3, 400), 4.13);   // 4.125 -> 4.13
  });
});

describe('formatPrice / formatVolume', () => {
  test('DE uses a decimal comma, EN a dot', () => {
    assert.equal(formatPrice(4.8, 'de'), '€4,80');
    assert.equal(formatPrice(4.8, 'en'), '€4.80');
  });
  test('missing price renders as an em dash, not "€NaN"', () => {
    assert.equal(formatPrice(null, 'de'), '—');
    assert.equal(formatPrice(undefined, 'en'), '—');
    assert.equal(formatPrice(NaN, 'en'), '—');
  });
  test('volumes', () => {
    assert.equal(formatVolume(500, 'en'), '0.50L');
    assert.equal(formatVolume(500, 'de'), '0,50L');
    assert.equal(formatVolume(330, 'de'), '0,33L');
    assert.equal(formatVolume(250, 'en'), '0.25L');
    assert.equal(formatVolume(1000, 'de'), '1,00L');
  });
  test('an unsupported / unknown volume has no label', () => {
    assert.equal(formatVolume(null, 'en'), null);
    assert.equal(formatVolume(999, 'en'), null);
    assert.equal(formatVolume(0, 'en'), null);
  });
});

describe('serving sizes', () => {
  test('the supported sizes map to ml', () => {
    assert.equal(volumeFromSize('0.25L'), 250);
    assert.equal(volumeFromSize('0.33L'), 330);
    assert.equal(volumeFromSize('0.4L'), 400);
    assert.equal(volumeFromSize('0.5L'), 500);
    assert.equal(volumeFromSize('1L'), 1000);
    assert.deepEqual([...VALID_VOLUMES_ML].sort((a, b) => a - b), [250, 330, 400, 500, 1000]);
  });
  test('anything else is invalid', () => {
    for (const bad of ['0.3L', '2L', '0,5L', '0.5l', '500', '', ' 0.5L', null, undefined, 500, {}, 'constructor', '__proto__', 'toString']) {
      assert.equal(isValidSize(bad), false, `expected ${JSON.stringify(bad)} to be invalid`);
      assert.equal(volumeFromSize(bad), null);
    }
  });
  test('isValidVolume', () => {
    assert.ok(isValidVolume(330));
    assert.ok(!isValidVolume(300));
    assert.ok(!isValidVolume('500'));
    assert.ok(!isValidVolume(null));
  });
});

describe('dates', () => {
  test('todayISO is the calendar date in Munich, not UTC', () => {
    assert.equal(todayISO(new Date('2026-09-20T12:00:00Z')), '2026-09-20');
    // 22:30 UTC on the 20th is 00:30 on the 21st in Munich (CEST, UTC+2).
    assert.equal(todayISO(new Date('2026-09-20T22:30:00Z')), '2026-09-21');
  });
  test('toDateOnly accepts real dates only', () => {
    assert.equal(toDateOnly('2026-09-20'), '2026-09-20');
    assert.equal(toDateOnly('2026-09-20T10:00:00.000Z'), '2026-09-20');
    for (const bad of ['2026-02-30', '2026-13-01', '20-09-2026', '', null, undefined, 20260920, 'yesterday']) {
      assert.equal(toDateOnly(bad), null, `expected ${JSON.stringify(bad)} -> null`);
    }
  });
  test('validateVisitDate: accepts today and the past', () => {
    assert.deepEqual(validateVisitDate('2026-09-20', NOW), { ok: true, value: '2026-09-20' });
    assert.deepEqual(validateVisitDate('2025-01-05', NOW), { ok: true, value: '2025-01-05' });
  });
  test('validateVisitDate: rejects the future, impossible dates and non-dates', () => {
    assert.equal(validateVisitDate('2026-09-21', NOW).ok, false);
    assert.equal(validateVisitDate('2030-01-01', NOW).ok, false);
    for (const bad of ['2026-02-30', '2026-9-1', '2026-09-20T10:00:00Z', 'today', '', null, 12345]) {
      assert.equal(validateVisitDate(bad, NOW).ok, false, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });
});

describe('getFreshness — verified_at, else price_observed_at, else UNKNOWN', () => {
  test('recent verified_at -> FRESH', () => {
    const f = getFreshness({ verified_at: daysAgo(4) }, NOW);
    assert.equal(f.state, 'FRESH');
    assert.equal(f.basis, 'verified');
    assert.equal(f.days, 4);
  });
  test('verified today -> FRESH with 0 days', () => {
    const f = getFreshness({ verified_at: daysAgo(0) }, NOW);
    assert.deepEqual([f.state, f.days], ['FRESH', 0]);
  });
  test('old verified_at -> STALE', () => {
    assert.equal(getFreshness({ verified_at: '2026-01-01' }, NOW).state, 'STALE');
  });
  test('no verified_at and no price_observed_at -> UNKNOWN', () => {
    assert.deepEqual(getFreshness({ verified_at: null, price_observed_at: null }, NOW),
      { state: 'UNKNOWN', basis: null, date: null, days: null });
    assert.equal(getFreshness({}, NOW).state, 'UNKNOWN');
    assert.equal(getFreshness(null, NOW).state, 'UNKNOWN');
    assert.equal(getFreshness(undefined, NOW).state, 'UNKNOWN');
  });
  test('falls back to price_observed_at when there is no verification', () => {
    const f = getFreshness({ verified_at: null, price_observed_at: daysAgo(10) }, NOW);
    assert.deepEqual([f.state, f.basis, f.days], ['FRESH', 'observed', 10]);
  });
  test('verified_at takes precedence over price_observed_at', () => {
    const f = getFreshness({ verified_at: daysAgo(2), price_observed_at: daysAgo(200) }, NOW);
    assert.deepEqual([f.state, f.basis, f.days], ['FRESH', 'verified', 2]);
  });
  test('threshold boundaries: 30 = FRESH, 31 = AGING, 90 = AGING, 91 = STALE', () => {
    assert.equal(FRESH_DAYS, 30);
    assert.equal(AGING_DAYS, 90);
    assert.equal(getFreshness({ verified_at: daysAgo(30) }, NOW).state, 'FRESH');
    assert.equal(getFreshness({ verified_at: daysAgo(31) }, NOW).state, 'AGING');
    assert.equal(getFreshness({ verified_at: daysAgo(90) }, NOW).state, 'AGING');
    assert.equal(getFreshness({ verified_at: daysAgo(91) }, NOW).state, 'STALE');
  });
  test('a malformed or future date is not a reliable timestamp -> UNKNOWN', () => {
    assert.equal(getFreshness({ verified_at: 'not-a-date' }, NOW).state, 'UNKNOWN');
    assert.equal(getFreshness({ verified_at: '2026-02-30' }, NOW).state, 'UNKNOWN');
    assert.equal(getFreshness({ price_observed_at: '2027-01-01' }, NOW).state, 'UNKNOWN');
  });
  test('a bad verified_at falls through to a good price_observed_at', () => {
    const f = getFreshness({ verified_at: 'garbage', price_observed_at: daysAgo(5) }, NOW);
    assert.deepEqual([f.state, f.basis], ['FRESH', 'observed']);
  });

  test('updated does NOT affect freshness: a brand-new `updated` on an unknown price stays UNKNOWN', () => {
    const f = getFreshness({ updated: daysAgo(0), verified_at: null, price_observed_at: null }, NOW);
    assert.equal(f.state, 'UNKNOWN');
  });
  test('updated does NOT affect freshness: a brand-new `updated` on an old verified price stays STALE', () => {
    const stale = { verified_at: '2026-01-01', price_observed_at: '2025-12-01' };
    const before = getFreshness({ ...stale, updated: '2025-06-01' }, NOW);
    const after = getFreshness({ ...stale, updated: daysAgo(0) }, NOW); // e.g. a venue spelling fix today
    assert.equal(after.state, 'STALE');
    assert.deepEqual(after, before);
  });
});

describe('resolveObservationDates — what to store when a price is recorded', () => {
  const existing = {
    size_05: 4.5, serving_volume_ml: 500, price_observed_at: '2026-07-01', verified_at: '2026-08-01',
  };

  test('a CHANGED price is observed on the given date and any earlier verification is cleared', () => {
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.8, newVolume: 500, observedAt: '2026-09-10' }),
      { price_observed_at: '2026-09-10', verified_at: null },
    );
  });
  test('a changed serving size counts as a change too', () => {
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.5, newVolume: 330, observedAt: '2026-09-10' }),
      { price_observed_at: '2026-09-10', verified_at: null },
    );
  });
  test('the same price seen again later moves the observation forward and supersedes an older verification', () => {
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.5, newVolume: 500, observedAt: '2026-09-10' }),
      { price_observed_at: '2026-09-10', verified_at: null },
    );
  });
  test('the same price seen again after the old observation but BEFORE the verification: observation moves, the newer verification is kept', () => {
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.5, newVolume: 500, observedAt: '2026-07-15' }),
      { price_observed_at: '2026-07-15', verified_at: '2026-08-01' },
    );
  });
  test('an older report never moves the observation date backwards', () => {
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.5, newVolume: 500, observedAt: '2026-06-01' }),
      { price_observed_at: '2026-07-01', verified_at: '2026-08-01' },
    );
  });
  test('an unknown observation date is filled in without touching a newer verification', () => {
    assert.deepEqual(
      resolveObservationDates({
        existing: { ...existing, price_observed_at: null },
        newPrice: 4.5, newVolume: 500, observedAt: '2026-07-20',
      }),
      { price_observed_at: '2026-07-20', verified_at: '2026-08-01' },
    );
  });
  test('an unusable observation date changes nothing (a date is never invented)', () => {
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.9, newVolume: 500, observedAt: 'soon' }),
      { price_observed_at: '2026-07-01', verified_at: '2026-08-01' },
    );
    assert.deepEqual(
      resolveObservationDates({ existing, newPrice: 4.9, newVolume: 500, observedAt: null }),
      { price_observed_at: '2026-07-01', verified_at: '2026-08-01' },
    );
  });
});
