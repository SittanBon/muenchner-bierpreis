// Zero-dependency test suite (Node's built-in test runner) covering the two
// confirmed QA-brief filter defects plus combined-filter behaviour, per
// Section 3's "Required tests" and Section 16's Definition of Done. Run with:
//   node --test backend/filterVenues.test.js
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { filterVenues, parsePriceBound } = require('./filterVenues');

// A small, hand-built fixture — deliberately NOT the live DB — so these tests
// never depend on (or mutate) real venue data and stay fast/deterministic.
function venue({ id, type, neighbourhood_id, brand, price, name = id, address = '' }) {
  return {
    id, name, type, neighbourhood_id, address,
    neighbourhood_name_de: neighbourhood_id, neighbourhood_name_en: neighbourhood_id,
    beers: [{ brand, size_05: price }],
  };
}

const FIXTURE = [
  venue({ id: 'v1', type: 'beer_garden', neighbourhood_id: 'altstadt', brand: 'Augustiner', price: 4.80, name: 'Alter Simpl' }),
  venue({ id: 'v2', type: 'bar', neighbourhood_id: 'schwabing', brand: 'Paulaner', price: 5.00 }),
  venue({ id: 'v3', type: 'restaurant', neighbourhood_id: 'maxvorstadt', brand: 'Augustiner', price: 5.20 }),
  venue({ id: 'v4', type: 'beer_hall', neighbourhood_id: 'isarvorstadt', brand: 'Spaten', price: 5.30, name: 'Casa Nostra' }),
  venue({ id: 'v5', type: 'beer_garden', neighbourhood_id: 'schwabing', brand: 'Hofbräu München', price: 6.95, address: 'Schwabinger Str. 1' }),
];
const TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];

describe('filterVenues — venue-type filter (Section 3.1)', () => {
  for (const type of TYPES) {
    test(`selecting ${type} returns only venues of that type`, () => {
      const result = filterVenues(FIXTURE, { type });
      assert.ok(result.length > 0, 'fixture should contain at least one match');
      assert.ok(result.every((v) => v.type === type));
    });
  }

  test('no type filter (the "Alle" case) returns the complete dataset', () => {
    assert.equal(filterVenues(FIXTURE, {}).length, FIXTURE.length);
    assert.equal(filterVenues(FIXTURE, { type: '' }).length, FIXTURE.length);
  });

  test('type + brand combine with AND logic', () => {
    const result = filterVenues(FIXTURE, { type: 'beer_garden', brand: 'Augustiner' });
    assert.deepEqual(result.map((v) => v.id), ['v1']);
  });

  test('type + district (neighbourhood) combine with AND logic', () => {
    const result = filterVenues(FIXTURE, { type: 'beer_garden', neighbourhood: 'schwabing' });
    assert.deepEqual(result.map((v) => v.id), ['v5']);
  });

  test('type + price range combine with AND logic', () => {
    const result = filterVenues(FIXTURE, { type: 'beer_garden', max_price: '5.00' });
    assert.deepEqual(result.map((v) => v.id), ['v1']);
  });
});

describe('filterVenues — price range filter, inclusive (Section 3.2)', () => {
  test('minimum + maximum: no venue below min or above max', () => {
    const result = filterVenues(FIXTURE, { min_price: '5.00', max_price: '5.20' });
    assert.deepEqual(result.map((v) => v.id).sort(), ['v2', 'v3']);
    assert.ok(result.every((v) => v.beers[0].size_05 >= 5.00 && v.beers[0].size_05 <= 5.20));
  });

  test('minimum-only filtering', () => {
    const result = filterVenues(FIXTURE, { min_price: '5.30' });
    assert.deepEqual(result.map((v) => v.id).sort(), ['v4', 'v5']);
  });

  test('maximum-only filtering — this is the confirmed bug: max must actually cap results', () => {
    const result = filterVenues(FIXTURE, { max_price: '5.20' });
    assert.deepEqual(result.map((v) => v.id).sort(), ['v1', 'v2', 'v3']);
    assert.ok(result.every((v) => v.beers[0].size_05 <= 5.20), 'no venue above the max must survive');
  });

  test('boundary values are included (inclusive range)', () => {
    const atMin = filterVenues(FIXTURE, { min_price: '5.00', max_price: '5.00' });
    assert.deepEqual(atMin.map((v) => v.id), ['v2']);
    const atMax = filterVenues(FIXTURE, { min_price: '4.80', max_price: '4.80' });
    assert.deepEqual(atMax.map((v) => v.id), ['v1']);
  });

  test('blank price fields do not become zero/NaN constraints', () => {
    assert.equal(filterVenues(FIXTURE, { min_price: '', max_price: '' }).length, FIXTURE.length);
    assert.equal(filterVenues(FIXTURE, {}).length, FIXTURE.length);
  });

  test('invalid (non-numeric) price input does not break filtering', () => {
    // Must NOT silently return zero results — garbage input is treated as
    // "no constraint", same as a blank field.
    assert.equal(filterVenues(FIXTURE, { max_price: 'abc' }).length, FIXTURE.length);
    assert.equal(filterVenues(FIXTURE, { min_price: 'NaN' }).length, FIXTURE.length);
  });

  test('price filtering combines with every other filter', () => {
    const result = filterVenues(FIXTURE, {
      min_price: '4.00', max_price: '6.00', neighbourhood: 'schwabing', brand: 'Paulaner',
    });
    assert.deepEqual(result.map((v) => v.id), ['v2']);
  });
});

describe('filterVenues — search', () => {
  test('search matches venue name', () => {
    assert.deepEqual(filterVenues(FIXTURE, { q: 'Simpl' }).map((v) => v.id), ['v1']);
  });
  test('search matches district/neighbourhood id', () => {
    assert.deepEqual(filterVenues(FIXTURE, { q: 'schwabing' }).map((v) => v.id).sort(), ['v2', 'v5']);
  });
  test('search matches street/address', () => {
    assert.deepEqual(filterVenues(FIXTURE, { q: 'Schwabinger Str' }).map((v) => v.id), ['v5']);
  });
  test('search matches beer brand', () => {
    assert.deepEqual(filterVenues(FIXTURE, { q: 'augustiner' }).map((v) => v.id).sort(), ['v1', 'v3']);
  });
  test('search is case-insensitive', () => {
    assert.deepEqual(filterVenues(FIXTURE, { q: 'CASA NOSTRA' }).map((v) => v.id), ['v4']);
  });
});

describe('parsePriceBound', () => {
  test('blank/missing values return null (no constraint)', () => {
    assert.equal(parsePriceBound(''), null);
    assert.equal(parsePriceBound(undefined), null);
    assert.equal(parsePriceBound(null), null);
  });
  test('non-numeric values return null instead of NaN', () => {
    assert.equal(parsePriceBound('abc'), null);
  });
  test('valid numeric strings parse correctly', () => {
    assert.equal(parsePriceBound('5.20'), 5.20);
    assert.equal(parsePriceBound('5'), 5);
  });
});
