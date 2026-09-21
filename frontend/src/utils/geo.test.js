import { describe, it, expect } from 'vitest';
import { distanceMeters, formatDistance, nearbyVenues, NEARBY_RADIUS_M } from './geo';

const MARIENPLATZ = { lat: 48.1374, lng: 11.5755 };
const venue = (id, lat, lng, price, extra = {}) => ({ id, lat, lng, beers: price == null ? [] : [{ normalized_500ml_price: price }], ...extra });

describe('distanceMeters', () => {
  it('is 0 for the same point and symmetric', () => {
    expect(distanceMeters(MARIENPLATZ, MARIENPLATZ)).toBe(0);
    const a = { lat: 48.14, lng: 11.58 }; const b = { lat: 48.15, lng: 11.6 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
  it('matches a known distance: Marienplatz -> Hauptbahnhof is about 1.0 km', () => {
    const d = distanceMeters(MARIENPLATZ, { lat: 48.1403, lng: 11.5600 });
    expect(d).toBeGreaterThan(1050); expect(d).toBeLessThan(1250);
  });
  it('one degree of latitude is about 111 km', () => {
    expect(distanceMeters({ lat: 48, lng: 11 }, { lat: 49, lng: 11 })).toBeCloseTo(111195, -2);
  });
});

describe('formatDistance', () => {
  it('rounds to 10 m below a km and uses the language decimal above', () => {
    expect(formatDistance(453, 'en')).toBe('450 m');
    expect(formatDistance(4, 'en')).toBe('10 m');
    expect(formatDistance(1234, 'en')).toBe('1.2 km');
    expect(formatDistance(1234, 'de')).toBe('1,2 km');
  });
  it('an unknown or invalid distance is null — never a made-up number', () => {
    for (const bad of [null, undefined, NaN, -5, Infinity, 'x']) expect(formatDistance(bad, 'de')).toBeNull();
  });
});

describe('nearbyVenues', () => {
  const near = (id, price, metresNorth) => venue(id, MARIENPLATZ.lat + metresNorth / 111195, MARIENPLATZ.lng, price);

  it('keeps only venues within the radius (default 1 km) and adds distance_m', () => {
    const out = nearbyVenues([near('a', 4, 300), near('b', 4, 1500)], MARIENPLATZ);
    expect(out.map((v) => v.id)).toEqual(['a']);
    expect(out[0].distance_m).toBeCloseTo(300, -1);
    expect(NEARBY_RADIUS_M).toBe(1000);
  });
  it('sorts cheapest per 0.5 L first; ties go to the nearer venue', () => {
    const out = nearbyVenues([near('dear', 6, 100), near('cheapFar', 3.5, 900), near('cheapNear', 3.5, 200), near('mid', 4.5, 50)], MARIENPLATZ);
    expect(out.map((v) => v.id)).toEqual(['cheapNear', 'cheapFar', 'mid', 'dear']);
  });
  it('a venue with no comparable price sorts last, not first', () => {
    const out = nearbyVenues([near('unknown', null, 10), near('priced', 5, 800)], MARIENPLATZ);
    expect(out.map((v) => v.id)).toEqual(['priced', 'unknown']);
  });
  it('venues without coordinates are never nearby, and no location means no results', () => {
    expect(nearbyVenues([venue('x', null, null, 4), venue('y', undefined, 11.5, 4)], MARIENPLATZ)).toEqual([]);
    expect(nearbyVenues([near('a', 4, 100)], null)).toEqual([]);
  });
  it('does not modify its input', () => {
    const input = [near('a', 4, 100)]; const before = JSON.stringify(input);
    nearbyVenues(input, MARIENPLATZ);
    expect(JSON.stringify(input)).toBe(before);
  });
});
