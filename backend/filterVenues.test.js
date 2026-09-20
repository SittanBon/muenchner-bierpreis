// Zero-dependency test suite (Node's built-in test runner) covering the two
// confirmed QA-brief filter defects plus combined-filter behaviour, per
// Section 3's "Required tests" and Section 16's Definition of Done. Run with:
//   node --test backend/filterVenues.test.js
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { filterVenues, parsePriceBound } = require('./filterVenues');
const { normalizePrice } = require('./utils/priceUtils');

// A small, hand-built fixture — deliberately NOT the live DB — so these tests
// never depend on (or mutate) real venue data and stay fast/deterministic.
// `volume` is the serving size (ml) the price is quoted for; like the real API,
// every beer carries the server-derived normalized_500ml_price.
function venue({ id, type, neighbourhood_id, brand, price, name = id, address = '', serve_type = 'unknown', extraBeer = null, volume = 500 }) {
  const beers = [{ brand, size_05: price, serving_volume_ml: volume, normalized_500ml_price: normalizePrice(price, volume), serve_type }];
  if (extraBeer) beers.push(extraBeer);
  return {
    id, name, type, neighbourhood_id, address,
    neighbourhood_name_de: neighbourhood_id, neighbourhood_name_en: neighbourhood_id,
    beers,
  };
}

const FIXTURE = [
  venue({ id: 'v1', type: 'beer_garden', neighbourhood_id: 'altstadt', brand: 'Augustiner', price: 4.80, name: 'Alter Simpl', serve_type: 'tap' }),
  venue({ id: 'v2', type: 'bar', neighbourhood_id: 'schwabing', brand: 'Paulaner', price: 5.00, serve_type: 'bottle' }),
  venue({ id: 'v3', type: 'restaurant', neighbourhood_id: 'maxvorstadt', brand: 'Augustiner', price: 5.20, serve_type: 'can' }),
  venue({ id: 'v4', type: 'beer_hall', neighbourhood_id: 'isarvorstadt', brand: 'Spaten', price: 5.30, name: 'Casa Nostra', serve_type: 'unknown' }),
  venue({ id: 'v5', type: 'beer_garden', neighbourhood_id: 'schwabing', brand: 'Hofbräu München', price: 6.95, address: 'Schwabinger Str. 1', serve_type: 'unknown',
    extraBeer: { brand: 'Tegernseer', size_05: 5.10, serve_type: 'tap' } }),
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

describe('filterVenues — serve type filter (Improvement 1)', () => {
  test('selecting tap returns only venues with a tap beer', () => {
    const result = filterVenues(FIXTURE, { serve_type: 'tap' });
    // v1's headline beer is tap; v5's headline is 'unknown' but its SECOND
    // beer is tap — matching on any of a venue's beers, not just the headline.
    assert.deepEqual(result.map((v) => v.id).sort(), ['v1', 'v5']);
  });

  test('selecting bottle/can isolate their own venue', () => {
    assert.deepEqual(filterVenues(FIXTURE, { serve_type: 'bottle' }).map((v) => v.id), ['v2']);
    assert.deepEqual(filterVenues(FIXTURE, { serve_type: 'can' }).map((v) => v.id), ['v3']);
  });

  test('selecting unknown matches v4 (headline) and v5 (headline is also unknown, despite its 2nd beer being tap)', () => {
    assert.deepEqual(filterVenues(FIXTURE, { serve_type: 'unknown' }).map((v) => v.id).sort(), ['v4', 'v5']);
  });

  test('no serve_type filter (the "Alle" case) returns the complete dataset', () => {
    assert.equal(filterVenues(FIXTURE, {}).length, FIXTURE.length);
    assert.equal(filterVenues(FIXTURE, { serve_type: '' }).length, FIXTURE.length);
  });

  test('an unrecognised serve_type value behaves like no filter, not zero results', () => {
    assert.equal(filterVenues(FIXTURE, { serve_type: 'draught' }).length, FIXTURE.length);
  });

  test('serve_type combines with type using AND logic', () => {
    const result = filterVenues(FIXTURE, { serve_type: 'tap', type: 'beer_garden' });
    assert.deepEqual(result.map((v) => v.id).sort(), ['v1', 'v5']);
  });

  test('serve_type combines with price range using AND logic', () => {
    const result = filterVenues(FIXTURE, { serve_type: 'tap', max_price: '5.00' });
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

describe('filterVenues — price bounds compare normalized 0.5 L prices', () => {
  const small = venue({ id: 's1', type: 'bar', neighbourhood_id: 'altstadt', brand: 'Helles', price: 3.50, volume: 330 }); // ≈ €5.30 per 0.5 L
  const unknownSize = venue({ id: 's2', type: 'bar', neighbourhood_id: 'altstadt', brand: 'Helles', price: 4.00, volume: null });
  const data = [...FIXTURE, small, unknownSize];

  test('€3.50 for 0.33 L is NOT cheap: a max of €4 excludes it', () => {
    const ids = filterVenues(data, { max_price: '4' }).map((v) => v.id);
    assert.ok(!ids.includes('s1'));
  });

  test('…and a min of €5 includes it (≈ €5.30 per 0.5 L)', () => {
    const ids = filterVenues(data, { min_price: '5' }).map((v) => v.id);
    assert.ok(ids.includes('s1'));
  });

  test('a price with no known serving size can\'t satisfy a price bound', () => {
    assert.ok(!filterVenues(data, { max_price: '10' }).some((v) => v.id === 's2'));
    assert.ok(!filterVenues(data, { min_price: '1' }).some((v) => v.id === 's2'));
  });

  test('…but is still listed when no price bound is applied', () => {
    assert.ok(filterVenues(data, {}).some((v) => v.id === 's2'));
  });
});
