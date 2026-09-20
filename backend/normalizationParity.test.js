// The per-0.5 L comparison price has ONE definition (normalizePrice in
// backend/utils/priceUtils.js). SQL can't call it, so the two places that must
// compute the same thing inside a query — sorting/averaging beers and averaging
// submissions for the Price Trends chart — carry the formula as SQL. This runs
// those exact SQL fragments and proves they agree with normalizePrice for every
// supported size over a grid of realistic prices.
//   node --test backend/normalizationParity.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bierpreis-norm-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
const { db, BEER_PRICE_500_SQL, SUBMISSION_PRICE_500_SQL } = require('./db/database');
const { normalizePrice, SIZE_TO_ML } = require('./utils/priceUtils');

const cents = (n) => Math.round(n * 100);
const prices = [];
for (let c = 100; c <= 1500; c += 5) prices.push(c / 100); // €1.00 … €15.00 in 5-cent steps

// Two things must hold between the SQL fragment and normalizePrice:
//  1. the FORMULA is identical — unrounded, they agree to floating-point noise;
//  2. rounded to cents they agree, except at an exact half-cent (e.g. €0.575),
//     where JS rounds half UP and SQLite's ROUND() works on the binary value
//     (0.57499999…) — never more than 1 cent apart. SQL only ever rounds an
//     AVG(), never a single displayed price, so that edge is by design.
function checkAgainst(sqlAt, ml, label) {
  for (const p of prices) {
    const row = sqlAt(p);
    const exact = p * 500 / ml;
    assert.ok(Math.abs(row.raw - exact) < 1e-9, `${label}: unrounded ${p} € @ ${ml} ml`);
    const diff = cents(row.n) - cents(normalizePrice(p, ml));
    if (diff !== 0) {
      const fractionalCents = exact * 100 - Math.floor(exact * 100);
      assert.ok(Math.abs(fractionalCents - 0.5) < 1e-6 && Math.abs(diff) === 1, `${label}: ${p} € @ ${ml} ml differs by ${diff} cent(s) away from a half-cent`);
    }
  }
}

test('BEER_PRICE_500_SQL (beers table) agrees with normalizePrice for every size and price', () => {
  const stmt = db.prepare(`SELECT ${BEER_PRICE_500_SQL} AS raw, ROUND(${BEER_PRICE_500_SQL}, 2) AS n FROM (SELECT ? AS size_05, ? AS serving_volume_ml)`);
  for (const ml of Object.values(SIZE_TO_ML)) checkAgainst((p) => stmt.get(p, ml), ml, 'beers');
});

test('SUBMISSION_PRICE_500_SQL (submissions table) agrees too, and ignores unknown sizes', () => {
  const stmt = db.prepare(`SELECT ${SUBMISSION_PRICE_500_SQL} AS raw, ROUND(${SUBMISSION_PRICE_500_SQL}, 2) AS n FROM (SELECT ? AS price, ? AS size) s`);
  for (const [size, ml] of Object.entries(SIZE_TO_ML)) checkAgainst((p) => stmt.get(p, size), ml, `submissions ${size}`);
  for (const bad of ['0.3L', '', null, '0.50L']) {
    assert.equal(stmt.get(4.5, bad).raw, null, `unknown size ${JSON.stringify(bad)} must not be normalised`);
  }
});

test('the beers-table SQL constant is the one actually used for sorting and averages', () => {
  const src = fs.readFileSync(path.join(__dirname, 'db', 'database.js'), 'utf8');
  assert.ok((src.match(/\$\{BEER_PRICE_500_SQL\}/g) || []).length >= 3, 'ORDER BY ×2 and the brand average use the constant');
  assert.doesNotMatch(src.replace(/const BEER_PRICE_500_SQL[^\n]*\n/, ''), /size_05 \* \$\{REFERENCE_VOLUME_ML\}/, 'no second hand-written copy of the formula');
});
