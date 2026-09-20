import { describe, it, expect } from 'vitest';
import { FRESH_DAYS, AGING_DAYS, getFreshness, freshnessText, todayISO, toDateOnly } from './freshness';

// Fixed clock so the tests never depend on the real date (noon UTC = 14:00 in Munich).
const NOW = new Date('2026-09-20T12:00:00Z');
const daysAgo = (n) => new Date(Date.UTC(2026, 8, 20 - n)).toISOString().slice(0, 10);

describe('getFreshness — verified_at, else price_observed_at, else UNKNOWN', () => {
  it('a recent verified_at is FRESH', () => {
    const f = getFreshness({ verified_at: daysAgo(4) }, NOW);
    expect([f.state, f.basis, f.days]).toEqual(['FRESH', 'verified', 4]);
  });

  it('an old verified_at is STALE', () => {
    expect(getFreshness({ verified_at: '2026-01-01' }, NOW).state).toBe('STALE');
  });

  it('no verified_at and no price_observed_at is UNKNOWN', () => {
    expect(getFreshness({ verified_at: null, price_observed_at: null }, NOW))
      .toEqual({ state: 'UNKNOWN', basis: null, date: null, days: null });
    expect(getFreshness(undefined, NOW).state).toBe('UNKNOWN');
  });

  it('falls back to price_observed_at when nothing was verified', () => {
    const f = getFreshness({ verified_at: null, price_observed_at: daysAgo(10) }, NOW);
    expect([f.state, f.basis]).toEqual(['FRESH', 'observed']);
  });

  it('the thresholds are 30 / 90 days, with 30 FRESH, 31 AGING, 90 AGING, 91 STALE', () => {
    expect([FRESH_DAYS, AGING_DAYS]).toEqual([30, 90]);
    expect(getFreshness({ verified_at: daysAgo(30) }, NOW).state).toBe('FRESH');
    expect(getFreshness({ verified_at: daysAgo(31) }, NOW).state).toBe('AGING');
    expect(getFreshness({ verified_at: daysAgo(90) }, NOW).state).toBe('AGING');
    expect(getFreshness({ verified_at: daysAgo(91) }, NOW).state).toBe('STALE');
  });

  it('a malformed or future date is not a reliable timestamp', () => {
    expect(getFreshness({ verified_at: 'nonsense' }, NOW).state).toBe('UNKNOWN');
    expect(getFreshness({ price_observed_at: '2027-01-01' }, NOW).state).toBe('UNKNOWN');
  });

  it('a changed `updated` does NOT affect freshness', () => {
    // An old verified price whose record was edited today (e.g. a spelling fix)…
    const stale = { verified_at: '2026-01-01', price_observed_at: '2025-12-01' };
    const before = getFreshness({ ...stale, updated: '2025-06-01' }, NOW);
    const after = getFreshness({ ...stale, updated: daysAgo(0) }, NOW);
    expect(after.state).toBe('STALE');
    expect(after).toEqual(before);
    // …and a price with no observation/verification stays UNKNOWN however new `updated` is.
    expect(getFreshness({ updated: daysAgo(0) }, NOW).state).toBe('UNKNOWN');
  });
});

describe('freshnessText — never claims more than the data supports', () => {
  it('a verified fresh price is "Bestätigt / Verified"', () => {
    expect(freshnessText(getFreshness({ verified_at: daysAgo(4) }, NOW)))
      .toEqual({ key: 'freshness.verifiedDaysAgo', count: 4 });
    expect(freshnessText(getFreshness({ verified_at: daysAgo(0) }, NOW))).toEqual({ key: 'freshness.verifiedToday' });
  });

  it('a fresh price that was only reported is "Aktualisiert / Updated", not "verified"', () => {
    expect(freshnessText(getFreshness({ price_observed_at: daysAgo(4) }, NOW)))
      .toEqual({ key: 'freshness.observedDaysAgo', count: 4 });
  });

  it('AGING and STALE both say the price may be outdated', () => {
    expect(freshnessText(getFreshness({ verified_at: daysAgo(60) }, NOW))).toEqual({ key: 'freshness.maybeOutdated' });
    expect(freshnessText(getFreshness({ verified_at: daysAgo(200) }, NOW))).toEqual({ key: 'freshness.maybeOutdated' });
  });

  it('UNKNOWN says the date is unknown — not "fresh"', () => {
    expect(freshnessText(getFreshness({}, NOW))).toEqual({ key: 'freshness.unknown' });
  });
});

describe('date helpers', () => {
  it('todayISO is the Munich calendar date', () => {
    expect(todayISO(new Date('2026-09-20T22:30:00Z'))).toBe('2026-09-21');
  });
  it('toDateOnly accepts real dates only', () => {
    expect(toDateOnly('2026-09-20T10:00:00Z')).toBe('2026-09-20');
    expect(toDateOnly('2026-02-30')).toBeNull();
    expect(toDateOnly(null)).toBeNull();
  });
});
