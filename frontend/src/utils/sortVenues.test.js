import { describe, it, expect } from 'vitest';
import { sortVenues, freshnessDate, SORT_OPTIONS, DEFAULT_SORT } from './sortVenues';
import { inBounds } from './geo';

const NOW = new Date('2026-09-21T12:00:00Z');
const beer = (n, over = {}) => ({ normalized_500ml_price: n, size_05: n, serving_volume_ml: 500, ...over });
const v = (name, n, over = {}, beerOver = {}) => ({ id: name, name, beers: n == null ? [] : [beer(n, beerOver)], ...over });
const names = (list) => list.map((x) => x.name);

describe('sortVenues', () => {
  const list = [v('Cee', 5), v('Aaa', 6), v('Bee', 4), v('Unknown', null), v('Dee', 5)];
  it('default is price ascending; unknown last; ties by name', () => {
    expect(DEFAULT_SORT).toBe('price_asc');
    expect(names(sortVenues(list))).toEqual(['Bee', 'Cee', 'Dee', 'Aaa', 'Unknown']);
  });
  it('price descending — an unknown price still never leads', () => {
    expect(names(sortVenues(list, 'price_desc'))).toEqual(['Aaa', 'Cee', 'Dee', 'Bee', 'Unknown']);
  });
  it('name A–Z, ignoring case and accents', () => {
    const l = [v('zebra', 4), v('Ähre', 4), v('Apfel', 4), v('bar', 4)];
    expect(names(sortVenues(l, 'name'))).toEqual(['Ähre', 'Apfel', 'bar', 'zebra']);
  });
  it('distance ascending; venues without a distance last', () => {
    const l = [v('Far', 4, { distance_m: 900 }), v('NoDist', 4), v('Near', 4, { distance_m: 120 }), v('Mid', 4, { distance_m: 400 })];
    expect(names(sortVenues(l, 'distance'))).toEqual(['Near', 'Mid', 'Far', 'NoDist']);
  });
  it('freshness: newest verified/observed date first, unknown last — `updated` is never read', () => {
    const l = [
      v('Old', 4, {}, { price_observed_at: '2026-06-01' }),
      v('Verified', 4, {}, { verified_at: '2026-09-19', price_observed_at: '2026-01-01' }),
      v('None', 4, {}, { updated: '2026-09-21' }),
      v('Recent', 4, {}, { price_observed_at: '2026-09-10' }),
      v('NoBeers', null),
    ];
    expect(names(sortVenues(l, 'freshness', NOW))).toEqual(['Verified', 'Recent', 'Old', 'NoBeers', 'None']);
  });
  it('freshnessDate follows the freshness rule (verified beats observed)', () => {
    expect(freshnessDate(v('x', 4, {}, { verified_at: '2026-09-01', price_observed_at: '2026-09-15' }), NOW)).toBe('2026-09-01');
    expect(freshnessDate(v('x', null), NOW)).toBeNull();
  });
  it('does not modify its input, and an unknown key falls back to price ascending', () => {
    const input = [v('B', 5), v('A', 4)]; const before = JSON.stringify(input);
    expect(names(sortVenues(input, 'bogus'))).toEqual(['A', 'B']);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('lists exactly the five options', () => expect(SORT_OPTIONS).toEqual(['price_asc', 'price_desc', 'name', 'distance', 'freshness']));
});

describe('inBounds', () => {
  const b = { south: 48.10, north: 48.20, west: 11.50, east: 11.65 };
  it('inside, outside, on the edge', () => {
    expect(inBounds({ lat: 48.15, lng: 11.58 }, b)).toBe(true);
    expect(inBounds({ lat: 48.25, lng: 11.58 }, b)).toBe(false);
    expect(inBounds({ lat: 48.15, lng: 11.7 }, b)).toBe(false);
    expect(inBounds({ lat: 48.10, lng: 11.50 }, b)).toBe(true);
  });
  it('no coordinates or no bounds means not in the area', () => {
    expect(inBounds({ lat: null, lng: null }, b)).toBe(false);
    expect(inBounds({ lat: 48.15, lng: 11.58 }, null)).toBe(false);
    expect(inBounds(undefined, b)).toBe(false);
  });
});
