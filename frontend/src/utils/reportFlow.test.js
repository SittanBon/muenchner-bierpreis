import { describe, it, expect } from 'vitest';
import { beerForBrand, prefillFromVenue, initialPriceForm, validateReport, buildPayload, NOTE_MAX, TOPICS, WRONG_FIELDS } from './reportFlow';

const beer = (brand, ml = 500, over = {}) => ({ brand, serving_volume_ml: ml, size_05: 4.5, ...over });
const venue = (beers) => ({ id: 'v1', name: 'Alter Simpl', beers });
const TODAY = '2026-09-21';
const good = { beer_brand: 'Augustiner', size_ml: 500, price: '4,80', visit_date: '2026-09-20', serve_type: 'tap', anonymous: false, submitter_name: '', note: '' };

describe('"Preis falsch?" pre-fill', () => {
  it('a venue with ONE brand: brand and its serving size are filled in', () => {
    expect(prefillFromVenue(venue([beer('Augustiner', 330)]))).toEqual({ brand: 'Augustiner', sizeMl: 330 });
  });
  it('several brands: no brand is guessed, the size is the headline beer’s', () => {
    expect(prefillFromVenue(venue([beer('Augustiner', 500), beer('Paulaner', 1000)]))).toEqual({ brand: '', sizeMl: 500 });
  });
  it('an unknown serving size stays EMPTY (the user must choose — 0.5 L is never assumed)', () => {
    expect(prefillFromVenue(venue([beer('Augustiner', null)]))).toEqual({ brand: 'Augustiner', sizeMl: '' });
    expect(prefillFromVenue(venue([beer('X', 123)])).sizeMl).toBe('');
  });
  it('a venue with no beers pre-fills nothing', () => {
    expect(prefillFromVenue(venue([]))).toEqual({ brand: '', sizeMl: '' });
    expect(prefillFromVenue(null)).toEqual({ brand: '', sizeMl: '' });
  });
  it('the price form: a correction is pre-filled, "Anderes Bier" starts blank on 0.5 L', () => {
    const v = venue([beer('Augustiner', 330)]);
    expect(initialPriceForm(v, 'price_change')).toEqual({ beer_brand: 'Augustiner', size_ml: 330 });
    expect(initialPriceForm(v, 'new_beer')).toEqual({ beer_brand: '', size_ml: 500 });
  });
  it('beerForBrand matches case-insensitively and ignores blanks', () => {
    const v = venue([beer('Augustiner', 330)]);
    expect(beerForBrand(v, ' augustiner ').serving_volume_ml).toBe(330);
    expect(beerForBrand(v, 'Paulaner')).toBeNull();
    expect(beerForBrand(v, '')).toBeNull();
  });
});

describe('validateReport', () => {
  it('a complete price report is valid; 4,80 and 4.80 both work', () => {
    expect(validateReport('price_change', good, TODAY)).toBeNull();
    expect(validateReport('new_beer', { ...good, price: '4.80' }, TODAY)).toBeNull();
  });
  it('each missing piece has its own message', () => {
    expect(validateReport('price_change', { ...good, beer_brand: '  ' }, TODAY)).toBe('report.errBrand');
    expect(validateReport('price_change', { ...good, size_ml: '' }, TODAY)).toBe('report.errSize');
    expect(validateReport('price_change', { ...good, size_ml: 300 }, TODAY)).toBe('report.errSize');
    expect(validateReport('price_change', { ...good, price: '' }, TODAY)).toBe('report.errPrice');
    expect(validateReport('price_change', { ...good, price: 'abc' }, TODAY)).toBe('report.errPrice');
  });
  it('the price must be in the API’s €1–30 range (bounds included)', () => {
    expect(validateReport('price_change', { ...good, price: '0,99' }, TODAY)).toBe('report.errPriceRange');
    expect(validateReport('price_change', { ...good, price: '30,01' }, TODAY)).toBe('report.errPriceRange');
    expect(validateReport('price_change', { ...good, price: '1' }, TODAY)).toBeNull();
    expect(validateReport('price_change', { ...good, price: '30' }, TODAY)).toBeNull();
  });
  it('the date must be real and not in the future', () => {
    expect(validateReport('price_change', { ...good, visit_date: '2026-09-22' }, TODAY)).toBe('report.errDate');
    expect(validateReport('price_change', { ...good, visit_date: '2026-02-30' }, TODAY)).toBe('report.errDate');
    expect(validateReport('price_change', { ...good, visit_date: '' }, TODAY)).toBe('report.errDate');
    expect(validateReport('price_change', { ...good, visit_date: TODAY }, TODAY)).toBeNull();
  });
  it('"other info" and a description need text, at most 300 characters', () => {
    for (const t of ['other_info', 'suggest_description']) {
      expect(validateReport(t, { note: '   ' })).toBe('report.errNote');
      expect(validateReport(t, { note: 'x'.repeat(NOTE_MAX) })).toBeNull();
      expect(validateReport(t, { note: 'x'.repeat(NOTE_MAX + 1) })).toBe('report.errNoteLong');
    }
    expect(NOTE_MAX).toBe(300);
  });
  it('"closed" asks for nothing', () => expect(validateReport('closed', {})).toBeNull());
});

describe('buildPayload', () => {
  const v = venue([beer('Augustiner')]);
  it('a price report: wire size, parsed price, serve type, date, name', () => {
    expect(buildPayload('price_change', v, { ...good, size_ml: 400, price: '4,80', submitter_name: ' Anna ' })).toEqual({
      report_type: 'price_change', venue_id: 'v1', venue_name: 'Alter Simpl', submitter_name: 'Anna',
      beer_brand: 'Augustiner', size: '0.4L', price: 4.8, serve_type: 'tap', visit_date: '2026-09-20',
    });
  });
  it('Anonym toggle or an empty name sends "Anonym"', () => {
    expect(buildPayload('price_change', v, { ...good, anonymous: true, submitter_name: 'Anna' }).submitter_name).toBe('Anonym');
    expect(buildPayload('price_change', v, { ...good, submitter_name: '  ' }).submitter_name).toBe('Anonym');
  });
  it('serve type falls back to "unknown"', () => expect(buildPayload('new_beer', v, { ...good, serve_type: '' }).serve_type).toBe('unknown'));
  it('other info carries the note and, when chosen, which field is wrong', () => {
    expect(buildPayload('other_info', v, { note: ' Adresse falsch ', wrong_field: 'address' })).toMatchObject({ note: 'Adresse falsch', wrong_field: 'address' });
    expect('wrong_field' in buildPayload('other_info', v, { note: 'x', wrong_field: '' })).toBe(false);
  });
  it('closed is anonymous and sends no personal data or note', () => {
    const p = buildPayload('closed', v, { submitter_name: 'Anna', note: 'ignored' });
    expect(p).toEqual({ report_type: 'closed', venue_id: 'v1', venue_name: 'Alter Simpl', submitter_name: 'Anonym' });
  });
  it('a description suggestion is just the note', () => {
    expect(buildPayload('suggest_description', v, { note: ' Nette Bar ', anonymous: true })).toMatchObject({ report_type: 'suggest_description', note: 'Nette Bar' });
  });
});

describe('constants', () => {
  it('the four topics in the specified order, and the five wrong-field choices', () => {
    expect(TOPICS.map((t) => [t.key, t.icon])).toEqual([['price_change', '💶'], ['new_beer', '🍺'], ['closed', '🔒'], ['other_info', 'ℹ️']]);
    expect(WRONG_FIELDS).toEqual(['name', 'address', 'hours', 'brand', 'other']);
  });
});
