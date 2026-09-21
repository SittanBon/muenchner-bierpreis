import { describe, it, expect } from 'vitest';
import { sizeLine, distanceText, hoursText, knownServeType, mapsLinks } from './venueView';

describe('sizeLine — serving size, only when known', () => {
  it('shows the label and the local name', () => {
    expect(sizeLine({ serving_volume_ml: 500 }, 'de')).toBe('0,50L · Halbe');
    expect(sizeLine({ serving_volume_ml: 500 }, 'en')).toBe('0.50L · Half litre');
    expect(sizeLine({ serving_volume_ml: 1000 }, 'de')).toBe('1,00L · Maß');
    expect(sizeLine({ serving_volume_ml: 330 }, 'en')).toBe('0.33L · Bottle');
  });
  it('an unknown size is null — 0.5 L is never assumed', () => {
    for (const beer of [{ serving_volume_ml: null }, {}, null, undefined, { serving_volume_ml: 123 }, { serving_volume_ml: 0 }]) {
      expect(sizeLine(beer, 'de')).toBeNull();
    }
  });
});

describe('distanceText — only with a real position', () => {
  const venue = { lat: 48.1374, lng: 11.5755 };
  it('formats a real distance', () => {
    const t = distanceText({ lat: 48.1374 + 320 / 111195, lng: 11.5755 }, venue, 'en');
    expect(t).toBe('320 m');
  });
  it('is null without a user position or without venue coordinates — never a fake or "0 m"', () => {
    expect(distanceText(null, venue, 'de')).toBeNull();
    expect(distanceText(undefined, venue, 'de')).toBeNull();
    expect(distanceText({ lat: NaN, lng: 11 }, venue, 'de')).toBeNull();
    expect(distanceText({ lat: 48, lng: 11 }, { lat: null, lng: null }, 'de')).toBeNull();
    expect(distanceText({ lat: 48, lng: 11 }, null, 'de')).toBeNull();
  });
  it('standing right at the venue never reads "0 m"', () => {
    expect(distanceText(venue, venue, 'de')).not.toMatch(/^0/);
  });
});

describe('hoursText — never an open/closed claim', () => {
  it('returns the stored text, trimmed', () => expect(hoursText({ opening_hours: ' Mo–So 9:00–23:30 ' })).toBe('Mo–So 9:00–23:30'));
  it('null for missing, empty or blank hours (the field is simply omitted)', () => {
    for (const v of [{}, { opening_hours: null }, { opening_hours: '' }, { opening_hours: '   ' }, { opening_hours: 42 }, null]) expect(hoursText(v)).toBeNull();
  });
});

describe('knownServeType', () => {
  it('tap / bottle / can only; unknown is null (so nothing is shown)', () => {
    for (const s of ['tap', 'bottle', 'can']) expect(knownServeType({ serve_type: s })).toBe(s);
    for (const s of ['unknown', '', null, undefined, 'keg']) expect(knownServeType({ serve_type: s })).toBeNull();
    expect(knownServeType(undefined)).toBeNull();
  });
});

describe('mapsLinks', () => {
  it('directions and reviews both carry name + address, encoded', () => {
    const l = mapsLinks({ name: 'Augustiner Keller', address: 'Arnulfstr. 52, München' });
    expect(l.directions).toBe('https://www.google.com/maps/dir/?api=1&destination=Augustiner%20Keller%20Arnulfstr.%2052%2C%20M%C3%BCnchen');
    expect(l.reviews).toBe('https://www.google.com/maps/search/?api=1&query=Augustiner%20Keller%20Arnulfstr.%2052%2C%20M%C3%BCnchen');
  });
  it('a venue without an address never produces the text "undefined"', () => {
    const l = mapsLinks({ name: 'Bar', address: null });
    expect(l.directions).toBe('https://www.google.com/maps/dir/?api=1&destination=Bar');
    expect(JSON.stringify(l)).not.toMatch(/undefined|null/);
  });
});
