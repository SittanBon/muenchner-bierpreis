import { describe, it, expect } from 'vitest';
import { pillModel, pillText, TYPE_COLORS, FRESHNESS_TINT } from './markerModel';

const NOW = new Date('2026-09-21T12:00:00Z');
const daysAgo = (n) => new Date(Date.UTC(2026, 8, 21 - n)).toISOString().slice(0, 10);
const venue = (beer, type = 'bar') => ({ type, beers: beer ? [beer] : [] });
const beer = (over = {}) => ({ size_05: 4.2, serving_volume_ml: 500, normalized_500ml_price: 4.2, price_observed_at: daysAgo(3), verified_at: null, ...over });

describe('pill text — the ACTUAL price, size only when it is not 0.5 L', () => {
  it('a 0.5 L price is just the price', () => expect(pillText(pillModel(venue(beer()), 'en', NOW))).toBe('€4.20'));
  it('€3.50 for 0.33 L reads "€3.50·0.33L" — never the €5.30 comparison figure', () => {
    const m = pillModel(venue(beer({ size_05: 3.5, serving_volume_ml: 330, normalized_500ml_price: 5.3 })), 'en', NOW);
    expect(pillText(m)).toBe('€3.50·0.33L');
    expect(pillText(m)).not.toContain('5.30');
  });
  it('German formatting: comma decimals in price and volume', () => {
    expect(pillText(pillModel(venue(beer({ size_05: 3.5, serving_volume_ml: 330 })), 'de', NOW))).toBe('€3,50·0,33L');
  });
  it('a 1 L Maß shows its size', () => {
    expect(pillText(pillModel(venue(beer({ size_05: 9.2, serving_volume_ml: 1000 })), 'en', NOW))).toBe('€9.20·1.00L');
  });
  it('an unknown serving size is shown as "?" — no size is claimed', () => {
    const m = pillModel(venue(beer({ serving_volume_ml: null })), 'en', NOW);
    expect(pillText(m)).toBe('€4.20·?');
    expect(m.sizeUnknown).toBe(true);
  });
  it('a venue with no priced beer shows a dash, not €0.00', () => {
    for (const v of [venue(null), venue(beer({ size_05: null })), venue(beer({ size_05: 0 }))]) {
      const m = pillModel(v, 'en', NOW);
      expect(m.hasPrice).toBe(false); expect(pillText(m)).toBe('—');
    }
  });
});

describe('freshness — tint AND a text glyph, from verified_at / price_observed_at only', () => {
  const state = (b) => pillModel(venue(b), 'en', NOW);
  it('FRESH white, no glyph', () => { const m = state(beer()); expect([m.state, m.tint, m.glyph]).toEqual(['FRESH', '#ffffff', '']); });
  it('AGING light yellow', () => { const m = state(beer({ price_observed_at: daysAgo(60) })); expect([m.state, m.tint]).toEqual(['AGING', '#fffbeb']); });
  it('STALE light red with a "!"', () => { const m = state(beer({ price_observed_at: daysAgo(200) })); expect([m.state, m.tint, m.glyph]).toEqual(['STALE', '#fff5f5', '!']); });
  it('UNKNOWN light grey with a "?"', () => { const m = state(beer({ price_observed_at: null })); expect([m.state, m.tint, m.glyph]).toEqual(['UNKNOWN', '#f5f5f5', '?']); });
  it('a recent verification beats an old observation', () => {
    expect(state(beer({ price_observed_at: daysAgo(300), verified_at: daysAgo(2) })).state).toBe('FRESH');
  });
  it('the technical `updated` date is never read', () => {
    expect(state(beer({ price_observed_at: null, updated: daysAgo(0) })).state).toBe('UNKNOWN');
  });
  it('the tints are exactly the specified colours', () => {
    expect(FRESHNESS_TINT).toEqual({ FRESH: '#ffffff', AGING: '#fffbeb', STALE: '#fff5f5', UNKNOWN: '#f5f5f5' });
  });
});

describe('venue-type border colour', () => {
  it('is exactly the specified colour per type, with a fallback', () => {
    expect(TYPE_COLORS).toEqual({ bar: '#92400e', beer_garden: '#2d7a2d', restaurant: '#5a3d1e', beer_hall: '#7a4a06' });
    expect(pillModel(venue(beer(), 'beer_garden'), 'en', NOW).typeColor).toBe('#2d7a2d');
    expect(pillModel(venue(beer(), 'mystery'), 'en', NOW).typeColor).toBe('#92400e');
  });
});
