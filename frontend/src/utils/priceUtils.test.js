import { describe, it, expect } from 'vitest';
import {
  normalizePrice, formatPrice, formatVolume, describePrice, isValidVolume, SERVING_SIZES,
} from './priceUtils';

// The frontend copy of the price normalisation/formatting rules. The backend
// suite (backend/priceUtils.test.js) covers the authoritative version, and
// backend/priceUtilsParity.test.js asserts the two agree on a wide input
// matrix — these cases pin the behaviour the UI itself depends on.

describe('normalizePrice', () => {
  it('€3.50 for 330 ml -> €5.30 per 0.5 L', () => expect(normalizePrice(3.5, 330)).toBe(5.3));
  it('a true half-cent rounds up (€2.90 @ 400 ml = 3.625 -> €3.63), matching the backend', () => {
    expect(normalizePrice(2.9, 400)).toBe(3.63);
    expect(normalizePrice(9.15, 1000)).toBe(4.58);
  });
  it('€4.20 for 500 ml -> €4.20', () => expect(normalizePrice(4.2, 500)).toBe(4.2));
  it('null price -> null', () => expect(normalizePrice(null, 500)).toBeNull());
  it('zero volume -> null', () => expect(normalizePrice(4.2, 0)).toBeNull());
  it('unknown (null) volume -> null, never the raw price', () => expect(normalizePrice(4.2, null)).toBeNull());
  it('rounds to cents', () => expect(normalizePrice(4.0, 330)).toBe(6.06));
});

describe('formatPrice / formatVolume', () => {
  it('uses a decimal comma in German and a dot in English', () => {
    expect(formatPrice(4.8, 'de')).toBe('€4,80');
    expect(formatPrice(4.8, 'en')).toBe('€4.80');
  });
  it('shows an em dash for a missing price', () => {
    expect(formatPrice(null, 'en')).toBe('—');
  });
  it('labels supported volumes and refuses unknown ones', () => {
    expect(formatVolume(330, 'de')).toBe('0,33L');
    expect(formatVolume(500, 'en')).toBe('0.50L');
    expect(formatVolume(1000, 'en')).toBe('1.00L');
    expect(formatVolume(null, 'en')).toBeNull();
    expect(formatVolume(999, 'en')).toBeNull();
  });
  it('offers exactly the supported serving sizes', () => {
    expect(SERVING_SIZES.map((s) => s.ml)).toEqual([250, 330, 400, 500, 1000]);
    expect(isValidVolume(330)).toBe(true);
    expect(isValidVolume(300)).toBe(false);
  });
});

describe('describePrice — the display rules', () => {
  it('a 0.33 L price: actual price primary, size shown, normalized comparison secondary', () => {
    const p = describePrice({ size_05: 3.5, serving_volume_ml: 330, normalized_500ml_price: 5.3 }, 'en');
    expect(p.actual).toBe('€3.50');       // what the guest pays
    expect(p.volumeLabel).toBe('0.33L');
    expect(p.normalized).toBe('€5.30');   // a comparison figure only
    expect(p.isReferenceSize).toBe(false);
    expect(p.sizeUnknown).toBe(false);
  });

  it('a 0.5 L price needs no normalized comparison', () => {
    const p = describePrice({ size_05: 4.2, serving_volume_ml: 500, normalized_500ml_price: 4.2 }, 'en');
    expect(p.actual).toBe('€4.20');
    expect(p.volumeLabel).toBe('0.50L');
    expect(p.normalized).toBeNull();
    expect(p.isReferenceSize).toBe(true);
  });

  it('an unknown serving size is flagged and claims no comparison price', () => {
    const p = describePrice({ size_05: 4.2, serving_volume_ml: null, normalized_500ml_price: null }, 'en');
    expect(p.actual).toBe('€4.20');
    expect(p.sizeUnknown).toBe(true);
    expect(p.volumeLabel).toBeNull();
    expect(p.normalized).toBeNull();
  });

  it('German formatting for both figures', () => {
    const p = describePrice({ size_05: 3.5, serving_volume_ml: 330, normalized_500ml_price: 5.3 }, 'de');
    expect([p.actual, p.volumeLabel, p.normalized]).toEqual(['€3,50', '0,33L', '€5,30']);
  });

  it('falls back to computing the comparison when an object lacks the server field', () => {
    expect(describePrice({ size_05: 3.5, serving_volume_ml: 330 }, 'en').normalized).toBe('€5.30');
  });
});
