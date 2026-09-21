import { describe, it, expect } from 'vitest';
import { sizeLine, distanceText, hoursText, knownServeType, mapsLinks, spokenVolume, priceAria, normalizedAria } from './venueView';

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

describe('spoken prices (screen readers)', () => {
  it('a 0.5 L price reads "4,20 Euro für 0,5 Liter" / "4.20 euros for 0.5 litres"', () => {
    const b = { size_05: 4.2, serving_volume_ml: 500 };
    expect(priceAria(b, 'de')).toBe('4,20 Euro für 0,5 Liter');
    expect(priceAria(b, 'en')).toBe('4.20 euros for 0.5 litres');
  });
  it('other sizes are spoken in litres', () => {
    expect(priceAria({ size_05: 3.5, serving_volume_ml: 330 }, 'de')).toBe('3,50 Euro für 0,33 Liter');
    expect(priceAria({ size_05: 9.2, serving_volume_ml: 1000 }, 'de')).toBe('9,20 Euro für 1 Liter');
    expect(priceAria({ size_05: 9.2, serving_volume_ml: 1000 }, 'en')).toBe('9.20 euros for 1 litre');
    expect(spokenVolume(400, 'de')).toBe('0,4 Liter');
    expect(spokenVolume(250, 'en')).toBe('0.25 litres');
  });
  it('an unknown size is SAID to be unknown — never read as 0.5 L', () => {
    expect(priceAria({ size_05: 4.5, serving_volume_ml: null }, 'de')).toBe('4,50 Euro, Größe unbekannt');
    expect(priceAria({ size_05: 4.5 }, 'en')).toBe('4.50 euros, size unknown');
    expect(spokenVolume(null, 'de')).toBeNull();
    expect(spokenVolume(123, 'de')).toBeNull();
  });
  it('no price, no sentence', () => {
    for (const b of [null, undefined, {}, { size_05: null }, { size_05: 0 }]) expect(priceAria(b, 'de')).toBeNull();
  });
  it('the comparison price: "ca. 5,30 Euro pro 0,5 Liter" — only when there is one', () => {
    expect(normalizedAria({ normalized_500ml_price: 5.3 }, 'de')).toBe('ca. 5,30 Euro pro 0,5 Liter');
    expect(normalizedAria({ normalized_500ml_price: 5.3 }, 'en')).toBe('approx. 5.30 euros per 0.5 litres');
    for (const b of [null, {}, { normalized_500ml_price: null }, { normalized_500ml_price: 0 }]) expect(normalizedAria(b, 'de')).toBeNull();
  });
});
