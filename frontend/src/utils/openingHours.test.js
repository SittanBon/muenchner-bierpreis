import { describe, it, expect } from 'vitest';
import { parseOpeningHours, isOpenNow, berlinParts } from './openingHours';

// A Munich wall-clock time as a Date. September = CEST (UTC+2).
const at = (iso) => new Date(`${iso}+02:00`); // e.g. '2026-09-21T18:30' (a Monday)

describe('parseOpeningHours — only what can be read without guessing', () => {
  it('reads the formats in the data', () => {
    expect(parseOpeningHours('Mo–So 17:00–1:00')).toEqual([{ days: [1, 2, 3, 4, 5, 6, 0], from: 1020, to: 60 }]);
    expect(parseOpeningHours('Di–Sa 18:00–24:00')[0]).toEqual({ days: [2, 3, 4, 5, 6], from: 1080, to: 1440 });
    expect(parseOpeningHours('Mo–Fr 11:00–3:00, Sa–So 12:00–3:00')).toHaveLength(2);
    expect(parseOpeningHours('Mo–Sa 8:00–19:00, So 9:00–19:00')[1].days).toEqual([0]);
  });
  it('a day list with a comma ("Mo, Do–So 6:30–1:00") joins the days', () => {
    expect(parseOpeningHours('Mo, Do–So 6:30–1:00')[0].days).toEqual([1, 4, 5, 6, 0]);
  });
  it('a range may wrap the week (Fr–Mo)', () => expect(parseOpeningHours('Fr–Mo 10:00–22:00')[0].days).toEqual([5, 6, 0, 1]));
  it('anything uncertain is unknown (null): seasonal notes, open-ended "ab", garbage, empty', () => {
    for (const t of ['Mo–So 11:00–23:00 (saisonal)', 'Mo–So 17:00–1:00 (Biergarten saisonal)', 'Mo–So 17:00–24:00, Sa–So ab 10:00',
      'nach Vereinbarung', 'Mo–So', '11:00–23:00', 'Mo–So 25:00–26:00', 'Mo–So 10:99–12:00', 'Mo–So 10:00–10:00', '', '   ', null, undefined, 42, 'Mo,']) {
      expect(parseOpeningHours(t), String(t)).toBeNull();
    }
  });
});

describe('isOpenNow — true / false / unknown, never a guess', () => {
  const H = 'Mo–So 11:30–23:00';
  it('inside and outside the hours', () => {
    expect(isOpenNow(H, at('2026-09-21T12:00'))).toBe(true);
    expect(isOpenNow(H, at('2026-09-21T23:30'))).toBe(false);
    expect(isOpenNow(H, at('2026-09-21T11:29'))).toBe(false);
    expect(isOpenNow(H, at('2026-09-21T11:30'))).toBe(true);
    expect(isOpenNow(H, at('2026-09-21T22:59'))).toBe(true);
    expect(isOpenNow(H, at('2026-09-21T23:00'))).toBe(false); // closing time itself: closed
  });
  it('respects the weekday (2026-09-21 is a Monday)', () => {
    expect(isOpenNow('Di–So 18:00–1:00', at('2026-09-21T20:00'))).toBe(false); // Monday: closed
    expect(isOpenNow('Di–So 18:00–1:00', at('2026-09-22T20:00'))).toBe(true);
  });
  it('a rule past midnight stays open after midnight on the NEXT day, but not on a day it does not start', () => {
    const late = 'Mo–So 17:00–1:00';
    expect(isOpenNow(late, at('2026-09-22T00:30'))).toBe(true);  // Tuesday 00:30, opened Monday
    expect(isOpenNow(late, at('2026-09-22T01:00'))).toBe(false);
    expect(isOpenNow('Mo 17:00–1:00', at('2026-09-22T00:30'))).toBe(true);   // Monday's rule carries into Tuesday
    expect(isOpenNow('Mo 17:00–1:00', at('2026-09-23T00:30'))).toBe(false);  // Tuesday's night: Monday isn't yesterday
    expect(isOpenNow('Mo–So 17:00–24:00', at('2026-09-21T23:59'))).toBe(true);
  });
  it('multi-segment hours use the segment for that day', () => {
    const h = 'Mo–Fr 11:00–15:00, Sa–So 12:00–20:00';
    expect(isOpenNow(h, at('2026-09-21T16:00'))).toBe(false); // Monday 16:00
    expect(isOpenNow(h, at('2026-09-26T16:00'))).toBe(true);  // Saturday 16:00
  });
  it('unreadable or absent hours are null — never open, never closed', () => {
    for (const t of [null, undefined, '', 'Mo–So 11:00–23:00 (saisonal)', 'nach Vereinbarung']) expect(isOpenNow(t, at('2026-09-21T12:00'))).toBeNull();
  });
  it('uses Munich time, not the machine\'s (UTC 21:30 in winter is 22:30 in Munich)', () => {
    expect(berlinParts(new Date('2026-12-15T21:30:00Z'))).toEqual({ day: 2, minute: 22 * 60 + 30 });
    expect(isOpenNow('Mo–So 10:00–22:00', new Date('2026-12-15T21:30:00Z'))).toBe(false);
    expect(isOpenNow('Mo–So 10:00–22:00', new Date('2026-12-15T20:30:00Z'))).toBe(true); // 21:30 Munich
  });
});
