import { describe, it, expect } from 'vitest';
import { venueMatchesQuery, normalizeText } from './adminSearch';
import { flagSearchTerms, flagSeverity, FLAG_ORDER } from './dataQualityFlags';

// The shape GET /api/admin/venues returns for each venue.
const v = (over = {}) => ({
  id: 'alter-simpl', name: 'Alter Simpl', address: 'Türkenstr. 57, 80799 München',
  neighbourhood_id: 'maxvorstadt', neighbourhood_name_de: 'Maxvorstadt', neighbourhood_name_en: 'Maxvorstadt',
  beers: [{ brand: 'Weihenstephaner', serving_volume_ml: 500 }],
  flags: [],
  ...over,
});
const hits = (query, venues) => venues.filter((x) => venueMatchesQuery(x, query)).map((x) => x.id);

describe('admin venue search — what it finds', () => {
  it('everything for an empty / blank query', () => {
    expect(venueMatchesQuery(v(), '')).toBe(true);
    expect(venueMatchesQuery(v(), '   ')).toBe(true);
  });
  it('by venue name', () => expect(venueMatchesQuery(v(), 'simpl')).toBe(true));
  it('by address (street and postcode)', () => {
    expect(venueMatchesQuery(v(), 'türkenstr')).toBe(true);
    expect(venueMatchesQuery(v(), '80799')).toBe(true);
    expect(venueMatchesQuery(v(), 'Schellingstr')).toBe(false);
  });
  it('by beer brand', () => {
    expect(venueMatchesQuery(v(), 'weihenstephaner')).toBe(true);
    expect(venueMatchesQuery(v(), 'paulaner')).toBe(false);
  });
  it('by neighbourhood — id, German and English name', () => {
    expect(venueMatchesQuery(v(), 'maxvorstadt')).toBe(true);
    const altstadt = v({ neighbourhood_id: 'altstadt', neighbourhood_name_de: 'Altstadt-Lehel', neighbourhood_name_en: 'Old Town & Lehel' });
    expect(venueMatchesQuery(altstadt, 'old town')).toBe(true);
    expect(venueMatchesQuery(altstadt, 'lehel')).toBe(true);
    expect(venueMatchesQuery(altstadt, 'altstadt')).toBe(true);
  });
  it('a neighbourhood name looked up by id when the venue row lacks it', () => {
    const bare = v({ neighbourhood_name_de: undefined, neighbourhood_name_en: undefined });
    expect(venueMatchesQuery(bare, 'Old Town', { maxvorstadt: 'Old Town Maxvorstadt' })).toBe(true);
  });
  it('ignoring case and accents', () => {
    expect(venueMatchesQuery(v({ name: 'Café Kosmos' }), 'CAFE')).toBe(true);
    expect(venueMatchesQuery(v({ name: 'Café Kosmos' }), 'café')).toBe(true);
    expect(normalizeText('Größe')).toBe('große');
  });
});

describe('admin venue search — serving size', () => {
  const beerAt = (ml) => v({ id: `ml${ml}`, beers: [{ brand: 'B', serving_volume_ml: ml }] });
  const all = [beerAt(250), beerAt(330), beerAt(400), beerAt(500), beerAt(1000), beerAt(null)];

  it('"0.33L", "0,33l", "330" and "330ml" all find a 330 ml beer', () => {
    for (const q of ['0.33L', '0,33l', '330', '330ml', '330 ml']) expect(hits(q, all)).toContain('ml330');
  });
  it('a 330 ml search does not match a 500 ml venue', () => {
    expect(hits('330ml', all)).toEqual(['ml330']);
  });
  it('Maß and Halbe', () => {
    expect(hits('maß', all)).toEqual(['ml1000']);
    expect(hits('halbe', all)).toEqual(['ml500']);
  });
  it('an unknown serving size can be searched for', () => {
    expect(hits('unknown size', all)).toEqual(['mlnull']);
    expect(hits('größe unbekannt', all)).toEqual(['mlnull']);
  });
});

describe('admin venue search — data-quality flags', () => {
  const stale = v({ id: 'stale-v', flags: [{ flag: 'STALE_PRICE', beer_id: 1, brand: 'X' }] });
  const dup = v({ id: 'dup-v', flags: [{ flag: 'DUPLICATE_VENUE', beer_id: null, brand: null }] });
  const clean = v({ id: 'clean-v', flags: [] });
  const all = [stale, dup, clean];

  it('"stale" finds exactly the stale venues', () => expect(hits('stale', all)).toEqual(['stale-v']));
  it('the flag code, spaced or with underscores, finds it', () => {
    expect(hits('stale_price', all)).toEqual(['stale-v']);
    expect(hits('stale price', all)).toEqual(['stale-v']);
  });
  it('aliases in English and German', () => {
    expect(hits('outdated', all)).toEqual(['stale-v']);
    expect(hits('veraltet', all)).toEqual(['stale-v']);
    expect(hits('duplicate', all)).toEqual(['dup-v']);
    expect(hits('doppelt', all)).toEqual(['dup-v']);
  });
  it('a venue with no flags is never matched by a flag word', () => {
    expect(hits('stale', [clean])).toEqual([]);
  });
  it('a dismissed (absent) flag is not searchable — search only sees the flags the server sent', () => {
    expect(hits('stale', [v({ id: 'was-stale', flags: [] })])).toEqual([]);
  });
});

describe('admin venue search — combining words', () => {
  it('every word must match (AND)', () => {
    const a = v({ id: 'a', flags: [{ flag: 'STALE_PRICE' }] });
    const b = v({ id: 'b', name: 'Other Bar', flags: [{ flag: 'STALE_PRICE' }] });
    expect(hits('stale simpl', [a, b])).toEqual(['a']);
    expect(hits('stale bar', [a, b])).toEqual(['b']);
  });
  it('words can hit different fields (brand + neighbourhood)', () => {
    expect(venueMatchesQuery(v(), 'weihenstephaner maxvorstadt')).toBe(true);
    expect(venueMatchesQuery(v(), 'weihenstephaner altstadt')).toBe(false);
  });
});

describe('flag metadata', () => {
  it('every ordered flag has a severity and search terms', () => {
    for (const code of FLAG_ORDER) {
      expect(['high', 'medium', 'low']).toContain(flagSeverity(code));
      expect(flagSearchTerms(code).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('an unknown flag code still gets sensible defaults instead of crashing', () => {
    expect(flagSeverity('SOMETHING_NEW')).toBe('low');
    expect(flagSearchTerms('SOMETHING_NEW')).toEqual(['something_new', 'something new']);
  });
});
