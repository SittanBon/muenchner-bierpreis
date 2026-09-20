// The backend (CommonJS) and frontend (ESM) each carry an implementation of the
// price normalisation, formatting and freshness rules — the frontend cannot
// import the backend module, and the brief asks for both. This test loads the
// REAL frontend modules and asserts they return exactly what the backend
// returns for the same inputs, so an edit to one side that isn't mirrored on
// the other fails here instead of shipping two different answers for the same
// price.
//   node --test backend/priceUtilsParity.test.js
'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const be = require('./utils/priceUtils');

let fePrice;
let feFresh;
let feSizes;

before(async () => {
  const dir = path.join(__dirname, '..', 'frontend', 'src', 'utils');
  fePrice = await import(pathToFileURL(path.join(dir, 'priceUtils.js')).href);
  feFresh = await import(pathToFileURL(path.join(dir, 'freshness.js')).href);
  feSizes = await import(pathToFileURL(path.join(dir, '..', 'constants', 'servingSizes.js')).href);
});

const NOW = new Date('2026-09-20T12:00:00Z');
const daysAgo = (n) => new Date(Date.UTC(2026, 8, 20 - n)).toISOString().slice(0, 10);

describe('normalisation + formatting parity', () => {
  test('normalizePrice agrees on valid, invalid and edge inputs', () => {
    const prices = [3.5, 4.2, 4.0, 3.999, 2.5, 9.2, 0, -1, null, undefined, NaN, '4.2', 'abc'];
    const volumes = [250, 330, 400, 500, 1000, 0, -500, null, undefined, NaN, '500', 'x'];
    for (const p of prices) {
      for (const v of volumes) {
        assert.equal(fePrice.normalizePrice(p, v), be.normalizePrice(p, v), `normalizePrice(${String(p)}, ${String(v)})`);
      }
    }
  });

  test('formatPrice agrees in both languages', () => {
    for (const p of [0, 3.5, 4.8, 12, 5.305, null, undefined, NaN]) {
      for (const lang of ['de', 'en']) {
        assert.equal(fePrice.formatPrice(p, lang), be.formatPrice(p, lang), `formatPrice(${String(p)}, ${lang})`);
      }
    }
  });

  test('formatVolume agrees, including unsupported volumes', () => {
    for (const ml of [250, 330, 400, 500, 1000, 0, 123, null, undefined, '500']) {
      for (const lang of ['de', 'en']) {
        assert.equal(fePrice.formatVolume(ml, lang), be.formatVolume(ml, lang), `formatVolume(${String(ml)}, ${lang})`);
      }
    }
  });

  test('both sides know the same price source types and notes limit', () => {
    assert.deepEqual(fePrice.SOURCE_TYPES, be.SOURCE_TYPES);
    assert.equal(fePrice.NOTES_MAX_LENGTH, be.NOTES_MAX_LENGTH);
  });

  test('both sides support the same serving sizes', () => {
    assert.deepEqual([...fePrice.VALID_VOLUMES_ML].sort((a, b) => a - b), [...be.VALID_VOLUMES_ML].sort((a, b) => a - b));
    assert.deepEqual(
      Object.fromEntries(fePrice.SERVING_SIZES.map((s) => [s.size, s.ml])),
      be.SIZE_TO_ML,
    );
    assert.equal(fePrice.REFERENCE_VOLUME_ML, be.REFERENCE_VOLUME_ML);
  });
});

describe('serving-size constant (frontend/src/constants/servingSizes.js)', () => {
  test('is exactly the five supported sizes, in ascending order', () => {
    assert.deepEqual(feSizes.SERVING_SIZES.map((s) => s.ml), [250, 330, 400, 500, 1000]);
    assert.deepEqual(feSizes.SERVING_SIZES.map((s) => s.label), ['0.25L', '0.33L', '0.40L', '0.50L', '1.00L']);
    assert.deepEqual(feSizes.SERVING_SIZES.map((s) => s.name_de), ['Kleines', 'Flasche', 'Kleines Helles', 'Halbe', 'Maß']);
    assert.deepEqual(feSizes.SERVING_SIZES.map((s) => s.name_en), ['Small', 'Bottle', 'Small Helles', 'Half litre', 'Full litre']);
  });
  test('matches the backend: same volumes, same wire values, same labels', () => {
    assert.deepEqual(feSizes.VALID_VOLUMES_ML, [...be.VALID_VOLUMES_ML].sort((a, b) => a - b));
    for (const s of feSizes.SERVING_SIZES) {
      assert.equal(be.volumeFromSize(s.size), s.ml, `wire value ${s.size}`);
      assert.equal(be.formatVolume(s.ml, 'en'), s.label, `backend label for ${s.ml}`);
      assert.equal(feSizes.servingLabel(s.ml, 'en'), s.label);
      assert.equal(feSizes.servingLabel(s.ml, 'de'), s.label.replace('.', ','));
      assert.equal(feSizes.wireSizeFromMl(s.ml), s.size);
    }
  });
  test('the dropdown text is "label — name (Nml)" in both languages', () => {
    assert.equal(feSizes.servingOptionText(250, 'en'), '0.25L — Small (250ml)');
    assert.equal(feSizes.servingOptionText(400, 'de'), '0,40L — Kleines Helles (400ml)');
    assert.equal(feSizes.servingOptionText(500, 'en'), '0.50L — Half litre (500ml)');
    assert.equal(feSizes.servingOptionText(1000, 'de'), '1,00L — Maß (1000ml)');
    assert.equal(feSizes.servingOptionText(123, 'en'), '');
  });
  test('unknown volumes have no size', () => {
    for (const bad of [null, undefined, 0, 123, NaN, 'x']) assert.equal(feSizes.servingSizeByMl(bad), null, String(bad));
  });
});

describe('freshness parity', () => {
  test('thresholds are identical', () => {
    assert.equal(feFresh.FRESH_DAYS, be.FRESH_DAYS);
    assert.equal(feFresh.AGING_DAYS, be.AGING_DAYS);
  });

  test('getFreshness agrees for every verified/observed age combination, past and future', () => {
    const ages = [null, -3, 0, 1, 29, 30, 31, 60, 89, 90, 91, 200, 'garbage', '2026-02-30'];
    const toDate = (a) => (typeof a === 'number' ? daysAgo(a) : a);
    for (const verified of ages) {
      for (const observed of ages) {
        // `updated` is set to "today" on every case: neither side may read it.
        const beer = { verified_at: toDate(verified), price_observed_at: toDate(observed), updated: daysAgo(0) };
        assert.deepEqual(
          feFresh.getFreshness(beer, NOW),
          be.getFreshness(beer, NOW),
          `verified=${String(verified)} observed=${String(observed)}`,
        );
      }
    }
  });

  test('getFreshness agrees on missing inputs', () => {
    for (const beer of [null, undefined, {}, { updated: daysAgo(0) }]) {
      assert.deepEqual(feFresh.getFreshness(beer, NOW), be.getFreshness(beer, NOW));
    }
  });

  test('"today" is the Munich calendar date on both sides', () => {
    for (const iso of ['2026-09-20T12:00:00Z', '2026-09-20T22:30:00Z', '2026-12-31T23:30:00Z', '2027-03-28T00:30:00Z']) {
      assert.equal(feFresh.todayISO(new Date(iso)), be.todayISO(new Date(iso)), iso);
    }
  });

  test('toDateOnly agrees', () => {
    for (const v of ['2026-09-20', '2026-09-20T10:00:00Z', '2026-02-30', 'nope', '', null, undefined, 20260920]) {
      assert.equal(feFresh.toDateOnly(v), be.toDateOnly(v), String(v));
    }
  });
});
