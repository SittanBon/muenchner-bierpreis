import { describe, it, expect } from 'vitest';
import { parsePrice, formatEuro } from './price';
import { formatPrice } from './priceUtils';

describe('parsePrice — comma and dot both work (Global Rule 2)', () => {
  it('accepts 4.80 and 4,80', () => {
    expect(parsePrice('4.80')).toBe(4.8);
    expect(parsePrice('4,80')).toBe(4.8);
    expect(parsePrice(' 4,8 ')).toBe(4.8);
  });
  it('rounds to cents and rejects junk', () => {
    expect(parsePrice('4,805')).toBe(4.81);
    for (const bad of [null, undefined, '', '  ', 'abc']) expect(parsePrice(bad)).toBeNull();
  });
});

describe('price display — one implementation (Global Rule 3)', () => {
  it('formatEuro IS formatPrice: same function, so the two can never disagree', () => {
    expect(formatEuro).toBe(formatPrice);
  });
  it('DE shows €4,80 and EN shows €4.80', () => {
    expect(formatEuro(4.8, 'de')).toBe('€4,80');
    expect(formatEuro(4.8, 'en')).toBe('€4.80');
    expect(formatEuro(5, 'de')).toBe('€5,00');
  });
  it('a missing price is an em dash, never €NaN', () => {
    for (const v of [null, undefined, NaN]) expect(formatEuro(v, 'de')).toBe('—');
  });
});
