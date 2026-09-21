import { describe, it, expect } from 'vitest';
import { QUICK_FILTERS, OPEN_NOW_CHIP, toggleQuickFilter, extraActiveFilters, countActiveFilters, emptyFilters } from './quickFilters';

describe('quick filter chips', () => {
  it('map to exactly the filters in the brief', () => {
    const patch = (id) => QUICK_FILTERS.find((q) => q.id === id).patch;
    expect(patch('max4')).toEqual({ max_price: '4.00' });
    expect(patch('max5')).toEqual({ max_price: '5.00' });
    expect(patch('garden')).toEqual({ type: 'beer_garden' });
    expect(patch('hall')).toEqual({ type: 'beer_hall' });
    expect(patch('tap')).toEqual({ serve_type: 'tap' });
  });
  it('applying a chip sets its field, leaving every other filter alone', () => {
    const f = { ...emptyFilters(), brand: 'Augustiner' };
    expect(toggleQuickFilter(f, 'max4')).toEqual({ ...f, max_price: '4.00' });
  });
  it('tapping an active chip clears it again', () => {
    const on = toggleQuickFilter(emptyFilters(), 'garden');
    expect(on.type).toBe('beer_garden');
    expect(toggleQuickFilter(on, 'garden')).toEqual(emptyFilters());
  });
  it('≤€4 and ≤€5 share max_price: choosing one replaces the other, never both active', () => {
    const f = toggleQuickFilter(toggleQuickFilter(emptyFilters(), 'max4'), 'max5');
    expect(f.max_price).toBe('5.00');
    expect(QUICK_FILTERS.filter((q) => q.isActive(f)).map((q) => q.id)).toEqual(['max5']);
  });
  it('a chip reads as active whichever way the value was typed (4, 4.0, "4,00" is not a number)', () => {
    const active = (max_price) => QUICK_FILTERS.find((q) => q.id === 'max4').isActive({ ...emptyFilters(), max_price });
    expect(active('4')).toBe(true); expect(active('4.0')).toBe(true); expect(active('4.5')).toBe(false); expect(active('')).toBe(false);
  });
  it('unknown chip ids change nothing', () => {
    const f = emptyFilters();
    expect(toggleQuickFilter(f, 'nope')).toBe(f);
  });
  it('"Jetzt geöffnet" is its own chip (it is only offered when hours are readable) and toggles open_now', () => {
    expect(QUICK_FILTERS.map((q) => q.id)).not.toContain('open');
    const on = toggleQuickFilter(emptyFilters(), 'open');
    expect(on.open_now).toBe(true);
    expect(OPEN_NOW_CHIP.isActive(on)).toBe(true);
    expect(toggleQuickFilter(on, 'open')).toEqual(emptyFilters());
  });
});

describe('extraActiveFilters — filters no chip shows', () => {
  it('nothing extra for the chips’ own values', () => {
    expect(extraActiveFilters({ ...emptyFilters(), max_price: '4.00', type: 'beer_garden', serve_type: 'tap' })).toEqual([]);
  });
  it('lists a brand, neighbourhood, other type, other serve type, min price and a custom max', () => {
    const f = { type: 'bar', brand: 'Paulaner', serve_type: 'bottle', neighbourhood: 'altstadt', min_price: '3.5', max_price: '4.6' };
    expect(extraActiveFilters(f).map((e) => e.id).sort()).toEqual(['brand', 'max_price', 'min_price', 'neighbourhood', 'serve_type', 'type']);
  });
  it('each extra knows how to clear itself', () => {
    const [e] = extraActiveFilters({ ...emptyFilters(), brand: 'Paulaner' });
    expect({ ...{ brand: 'Paulaner' }, ...e.clear }.brand).toBe('');
  });
});

describe('countActiveFilters — the "Mehr (n)" badge', () => {
  it('a price range counts ONCE, however many of min/max are set', () => {
    expect(countActiveFilters({ ...emptyFilters(), min_price: '3.5' })).toBe(1);
    expect(countActiveFilters({ ...emptyFilters(), max_price: '5' })).toBe(1);
    expect(countActiveFilters({ ...emptyFilters(), min_price: '3.5', max_price: '5' })).toBe(1);
  });
  it('counts open-now like any other filter; "Biergarten + ≤ €4" is 2', () => {
    expect(countActiveFilters({ ...emptyFilters(), open_now: true })).toBe(1);
    expect(countActiveFilters({ ...emptyFilters(), type: 'beer_garden', max_price: '4.00' })).toBe(2);
  });

  it('counts every non-empty filter', () => {
    expect(countActiveFilters(emptyFilters())).toBe(0);
    expect(countActiveFilters({ ...emptyFilters(), type: 'bar', max_price: '4.00', brand: 'x' })).toBe(3);
  });
});
