import { describe, it, expect } from 'vitest';
import { PRICE_LEVELS, NO_DATA_LEVEL, priceLevel, levelLabel } from '../constants/priceLevels';

describe('price levels (neighbourhood shading)', () => {
  const id = (p) => priceLevel(p).id;
  it('classifies by the specified ranges', () => {
    expect(id(3.9)).toBe('VERY_CHEAP');
    expect(id(4.49)).toBe('VERY_CHEAP');
    expect(id(4.6)).toBe('CHEAP');
    expect(id(5.25)).toBe('MODERATE');
    expect(id(5.64)).toBe('EXPENSIVE');
    expect(id(6.11)).toBe('VERY_EXPENSIVE');
  });
  it('the boundaries: 4.50 is CHEAP, 5.00 MODERATE, 5.50 EXPENSIVE, 6.00 still EXPENSIVE, above 6.00 VERY_EXPENSIVE', () => {
    expect([4.5, 5.0, 5.5, 6.0, 6.01].map(id)).toEqual(['CHEAP', 'MODERATE', 'EXPENSIVE', 'EXPENSIVE', 'VERY_EXPENSIVE']);
  });
  it('no price is NO_DATA — never "cheap"', () => {
    for (const p of [null, undefined, '', NaN, 0, -3, 'abc']) expect(priceLevel(p)).toBe(NO_DATA_LEVEL);
  });
  it('uses exactly the specified colours', () => {
    expect(PRICE_LEVELS.map((l) => [l.id, l.color])).toEqual([
      ['VERY_CHEAP', '#dcfce7'], ['CHEAP', '#fef9c3'], ['MODERATE', '#ffedd5'], ['EXPENSIVE', '#fee2e2'], ['VERY_EXPENSIVE', '#fecaca'],
    ]);
    expect(NO_DATA_LEVEL.color).toBe('#f5f5f5');
  });
  it('every level has a German and an English name (colour is never the only cue)', () => {
    for (const l of [...PRICE_LEVELS, NO_DATA_LEVEL]) { expect(levelLabel(l, 'de')).toBeTruthy(); expect(levelLabel(l, 'en')).toBeTruthy(); }
    expect(levelLabel(PRICE_LEVELS[0], 'de')).toBe('Sehr günstig');
  });
  it('levels are ordered cheapest to dearest', () => {
    const ups = PRICE_LEVELS.map((l) => l.upTo);
    expect([...ups].sort((a, b) => a - b)).toEqual(ups);
  });
});
