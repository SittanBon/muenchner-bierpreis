// Tests for backend/dataQuality.js — the automatic flags behind the admin
// "Data Quality" tab. Pure functions over hydrated venues, no database.
//   node --test backend/dataQuality.test.js
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  THRESHOLDS, FLAG_TYPES, FLAG_CODES, flagKey, normalizeName, computeFlags, summarizeFlags, groupFlagsByVenue,
} = require('./dataQuality');

let beerSeq = 0;
// A healthy beer: real price, known + confirmed size, freshly observed.
const beer = (over = {}) => {
  beerSeq += 1;
  return {
    id: beerSeq, brand: `Brand ${beerSeq}`, size_05: 5.0, serving_volume_ml: 500, normalized_500ml_price: 5.0,
    price_observed_at: '2026-09-10', verified_at: null, freshness_state: 'FRESH', size_confirmed: true, ...over,
  };
};
const venue = (id, over = {}) => ({
  id, name: `Venue ${id}`, neighbourhood_id: 'h1', neighbourhood_name_de: 'H1', neighbourhood_name_en: 'H1',
  active: true, beers: [beer()], ...over,
});
const flagsOf = (venues, dismissed) => computeFlags(venues, dismissed).map((f) => f.flag);

describe('a healthy venue', () => {
  test('raises no flags', () => {
    assert.deepEqual(computeFlags([venue('a')]), []);
  });
});

describe('MISSING_SERVING_SIZE', () => {
  test('a beer with no serving_volume_ml is flagged', () => {
    const v = venue('a', { beers: [beer({ serving_volume_ml: null, normalized_500ml_price: null })] });
    assert.ok(flagsOf([v]).includes('MISSING_SERVING_SIZE'));
  });
  test('a known size is not', () => assert.ok(!flagsOf([venue('a')]).includes('MISSING_SERVING_SIZE')));
});

describe('ASSUMED_HALF_LITRE (Fix 3: serving size review helper)', () => {
  test('a 500 ml size nobody has confirmed is flagged', () => {
    const v = venue('a', { beers: [beer({ size_confirmed: false })] });
    assert.ok(flagsOf([v]).includes('ASSUMED_HALF_LITRE'));
  });
  test('a confirmed 500 ml size is not flagged', () => {
    assert.ok(!flagsOf([venue('a')]).includes('ASSUMED_HALF_LITRE')); // default beer() is confirmed
  });
  test('an unconfirmed size that is NOT 500 ml is not flagged — only the backfill\'s specific guess is', () => {
    const v = venue('a', { beers: [beer({ serving_volume_ml: 330, normalized_500ml_price: 7.6, size_confirmed: false })] });
    assert.ok(!flagsOf([v]).includes('ASSUMED_HALF_LITRE'));
  });
  test('an unconfirmed 500 ml beer with no price is not flagged (MISSING_PRICE covers it instead)', () => {
    const v = venue('a', { beers: [beer({ size_05: null, normalized_500ml_price: null, size_confirmed: false })] });
    const f = flagsOf([v]);
    assert.ok(!f.includes('ASSUMED_HALF_LITRE'));
    assert.ok(f.includes('MISSING_PRICE'));
  });
  test('not verifiable — confirming the PRICE says nothing about the SIZE', () => {
    assert.equal(FLAG_TYPES.ASSUMED_HALF_LITRE.verifiable, false);
  });
});

describe('MISSING_PRICE vs INVALID_PRICE', () => {
  test('null and 0 are MISSING_PRICE (and not also INVALID_PRICE)', () => {
    for (const price of [null, 0]) {
      const f = flagsOf([venue('a', { beers: [beer({ size_05: price, normalized_500ml_price: null })] })]);
      assert.ok(f.includes('MISSING_PRICE'), `price ${price}`);
      assert.ok(!f.includes('INVALID_PRICE'), `price ${price} must not also be INVALID`);
    }
  });
  test('below €0.50 or above €20.00 is INVALID_PRICE; the bounds themselves are fine', () => {
    const invalid = (p) => flagsOf([venue('a', { beers: [beer({ size_05: p, normalized_500ml_price: p })] })]).includes('INVALID_PRICE');
    assert.equal(invalid(0.49), true);
    assert.equal(invalid(0.5), false);
    assert.equal(invalid(20.0), false);
    assert.equal(invalid(20.01), true);
    assert.equal(THRESHOLDS.MIN_PRICE, 0.5);
    assert.equal(THRESHOLDS.MAX_PRICE, 20.0);
  });
});

describe('MISSING_OBSERVATION_DATE', () => {
  test('flagged only when BOTH price_observed_at and verified_at are missing', () => {
    const f = (over) => flagsOf([venue('a', { beers: [beer(over)] })]).includes('MISSING_OBSERVATION_DATE');
    assert.equal(f({ price_observed_at: null, verified_at: null }), true);
    assert.equal(f({ price_observed_at: '2026-09-01', verified_at: null }), false);
    assert.equal(f({ price_observed_at: null, verified_at: '2026-09-01' }), false);
  });
});

describe('STALE_PRICE', () => {
  test('flagged on a STALE freshness state only', () => {
    const f = (state) => flagsOf([venue('a', { beers: [beer({ freshness_state: state })] })]).includes('STALE_PRICE');
    assert.equal(f('STALE'), true);
    for (const s of ['FRESH', 'AGING', 'UNKNOWN']) assert.equal(f(s), false, s);
  });
});

describe('EXTREME_NORMALIZED_PRICE', () => {
  test('flags a per-0.5 L comparison price above €15.00 (15.00 itself is fine)', () => {
    const f = (n) => flagsOf([venue('a', { beers: [beer({ normalized_500ml_price: n })] })]).includes('EXTREME_NORMALIZED_PRICE');
    assert.equal(f(15.0), false);
    assert.equal(f(15.01), true);
    assert.equal(f(null), false);
    assert.equal(THRESHOLDS.MAX_NORMALIZED_PRICE, 15.0);
  });
  test('an ordinary actual price can still be an extreme normalized one (€8 for 0.25 L = €16 per 0.5 L)', () => {
    const b = beer({ size_05: 8, serving_volume_ml: 250, normalized_500ml_price: 16 });
    const f = flagsOf([venue('a', { beers: [b] })]);
    assert.ok(f.includes('EXTREME_NORMALIZED_PRICE'));
    assert.ok(!f.includes('INVALID_PRICE'), 'the actual price €8 is plausible');
  });
});

describe('VENUE_WITHOUT_ACTIVE_PRICE', () => {
  test('no beers at all', () => assert.ok(flagsOf([venue('a', { beers: [] })]).includes('VENUE_WITHOUT_ACTIVE_PRICE')));
  test('only beers without a usable price', () => {
    const v = venue('a', { beers: [beer({ size_05: null, normalized_500ml_price: null }), beer({ size_05: 0, normalized_500ml_price: null })] });
    assert.ok(flagsOf([v]).includes('VENUE_WITHOUT_ACTIVE_PRICE'));
  });
  test('one priced beer is enough', () => {
    const v = venue('a', { beers: [beer({ size_05: null, normalized_500ml_price: null }), beer()] });
    assert.ok(!flagsOf([v]).includes('VENUE_WITHOUT_ACTIVE_PRICE'));
  });
  test('is a venue-level flag (no beer attached)', () => {
    const [f] = computeFlags([venue('a', { beers: [] })]);
    assert.deepEqual([f.flag, f.beer_id, f.brand], ['VENUE_WITHOUT_ACTIVE_PRICE', null, null]);
  });
});

describe('DUPLICATE_VENUE — same name in the same neighbourhood', () => {
  test('flags every member of the group, and names the others', () => {
    const a = venue('a', { name: 'Alter Simpl' });
    const b = venue('b', { name: 'Alter Simpl' });
    const flags = computeFlags([a, b]).filter((f) => f.flag === 'DUPLICATE_VENUE');
    assert.deepEqual(flags.map((f) => f.venue_id).sort(), ['a', 'b']);
    assert.deepEqual(flags.find((f) => f.venue_id === 'a').detail.also, [{ id: 'b', name: 'Alter Simpl' }]);
  });
  test('ignores case, accents and extra spaces', () => {
    const f = flagsOf([venue('a', { name: 'Café  Kosmos' }), venue('b', { name: ' cafe kosmos ' })]);
    assert.equal(f.filter((x) => x === 'DUPLICATE_VENUE').length, 2);
    assert.equal(normalizeName('  Café   Kosmos '), 'cafe kosmos');
  });
  test('the same name in a DIFFERENT neighbourhood is not a duplicate', () => {
    const f = flagsOf([venue('a', { name: 'Hofbräu', neighbourhood_id: 'h1' }), venue('b', { name: 'Hofbräu', neighbourhood_id: 'h2' })]);
    assert.ok(!f.includes('DUPLICATE_VENUE'));
  });
  test('an inactive copy is not a duplicate on the live site', () => {
    const f = flagsOf([venue('a', { name: 'X' }), venue('b', { name: 'X', active: false })]);
    assert.ok(!f.includes('DUPLICATE_VENUE'));
  });
});

describe('scope', () => {
  test('inactive venues are never flagged at all', () => {
    assert.deepEqual(computeFlags([venue('a', { active: false, beers: [] })]), []);
  });
  test('computeFlags does not modify its input', () => {
    const v = [venue('a', { beers: [beer({ serving_volume_ml: null })] })];
    const before = JSON.stringify(v);
    computeFlags(v);
    assert.equal(JSON.stringify(v), before);
  });
});

describe('dismissals', () => {
  test('a dismissed flag key hides exactly that flag instance', () => {
    const b = beer({ serving_volume_ml: null, normalized_500ml_price: null, price_observed_at: null });
    const v = venue('a', { beers: [b] });
    assert.deepEqual(flagsOf([v]).sort(), ['MISSING_OBSERVATION_DATE', 'MISSING_SERVING_SIZE']);
    const dismissed = new Set([flagKey('MISSING_SERVING_SIZE', 'a', b.id)]);
    assert.deepEqual(flagsOf([v], dismissed), ['MISSING_OBSERVATION_DATE']);
  });
  test('dismissing a flag on one beer does not hide it on another', () => {
    const b1 = beer({ serving_volume_ml: null }); const b2 = beer({ serving_volume_ml: null });
    const dismissed = new Set([flagKey('MISSING_SERVING_SIZE', 'a', b1.id)]);
    const left = computeFlags([venue('a', { beers: [b1, b2] })], dismissed).filter((f) => f.flag === 'MISSING_SERVING_SIZE');
    assert.deepEqual(left.map((f) => f.beer_id), [b2.id]);
  });
  test('venue-level flags use beer id 0', () => {
    const dismissed = new Set([flagKey('VENUE_WITHOUT_ACTIVE_PRICE', 'a', 0)]);
    assert.deepEqual(computeFlags([venue('a', { beers: [] })], dismissed), []);
  });
});

describe('summarizeFlags — "X venues need attention"', () => {
  test('counts DISTINCT venues, not flag instances', () => {
    const a = venue('a', { beers: [beer({ serving_volume_ml: null }), beer({ serving_volume_ml: null })] }); // 2 flags, 1 venue
    const b = venue('b', { beers: [beer({ freshness_state: 'STALE' })] });
    const c = venue('c'); // healthy
    const s = summarizeFlags(computeFlags([a, b, c]));
    assert.equal(s.venues_needing_attention, 2);
    assert.equal(s.total_flags, 3);
    assert.equal(s.by_flag.MISSING_SERVING_SIZE, 2);
    assert.equal(s.by_flag.STALE_PRICE, 1);
  });
  test('by_flag has a zero entry for every flag type', () => {
    const s = summarizeFlags([]);
    assert.deepEqual(Object.keys(s.by_flag).sort(), [...FLAG_CODES].sort());
    assert.equal(s.venues_needing_attention, 0);
  });
});

describe('groupFlagsByVenue', () => {
  test('lists the worst venues first and each venue’s worst flag first', () => {
    const low = venue('low', { name: 'Aaa', beers: [beer({ price_observed_at: null })] });                         // only a LOW flag
    const high = venue('high', { name: 'Zzz', beers: [beer({ size_05: 25, normalized_500ml_price: 25 })] });        // INVALID_PRICE (high)
    const groups = groupFlagsByVenue(computeFlags([low, high]), [low, high]);
    assert.deepEqual(groups.map((g) => g.venue_id), ['high', 'low']);
    assert.equal(groups[0].flags[0].severity, 'high');
  });
  test('marks which flags a one-click Verify makes sense for', () => {
    assert.equal(FLAG_TYPES.STALE_PRICE.verifiable, true);
    assert.equal(FLAG_TYPES.MISSING_OBSERVATION_DATE.verifiable, true);
    assert.equal(FLAG_TYPES.EXTREME_NORMALIZED_PRICE.verifiable, true);
    // Verifying can't fix any of these — it would only "confirm" a bad record.
    for (const c of ['MISSING_PRICE', 'INVALID_PRICE', 'MISSING_SERVING_SIZE', 'VENUE_WITHOUT_ACTIVE_PRICE', 'DUPLICATE_VENUE', 'ASSUMED_HALF_LITRE']) {
      assert.equal(FLAG_TYPES[c].verifiable, false, c);
    }
  });
  test('carries the venue’s neighbourhood for display', () => {
    const v = venue('a', { beers: [beer({ price_observed_at: null })] });
    const [g] = groupFlagsByVenue(computeFlags([v]), [v]);
    assert.deepEqual([g.name, g.neighbourhood_name_de], ['Venue a', 'H1']);
  });
});
