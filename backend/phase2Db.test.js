// Database-level tests for Phase 2: the additive migration, the price editor's
// new fields, price-history rules (a real change writes an entry; Verify, a
// no-op save and a rejection never do), the history viewer, flag dismissals
// and the enriched submission view. Runs against a throwaway SQLite file that
// starts in the PHASE 1 shape (beers without source_type/notes, no
// price_history / flag_dismissals tables), so the real migration is exercised.
//   node --test backend/phase2Db.test.js
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bierpreis-phase2-'));
const dbFile = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbFile;

// ── A Phase-1 database: trust columns exist, Phase 2 ones don't.
{
  const legacy = new Database(dbFile);
  legacy.exec(`
    CREATE TABLE neighbourhoods (
      id TEXT PRIMARY KEY, name_de TEXT NOT NULL, name_en TEXT NOT NULL, short_name_de TEXT, short_name_en TEXT,
      center_lat REAL, center_lng REAL, description_de TEXT, description_en TEXT, city_id INTEGER DEFAULT 1
    );
    CREATE TABLE venues (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      neighbourhood_id TEXT NOT NULL REFERENCES neighbourhoods(id),
      address TEXT, lat REAL, lng REAL, opening_hours TEXT, website TEXT, description_de TEXT, description_en TEXT,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      outside_modelled_area INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE beers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      brand TEXT NOT NULL, size_05 REAL, size_mass REAL, updated TEXT, reports INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1, serve_type TEXT NOT NULL DEFAULT 'unknown',
      price_observed_at TEXT, verified_at TEXT, serving_volume_ml INTEGER
    );
    INSERT INTO neighbourhoods (id, name_de, name_en) VALUES ('hood1', 'Hood 1', 'Hood 1');
    INSERT INTO venues (id, name, type, neighbourhood_id) VALUES ('legacy-venue', 'Legacy Venue', 'bar', 'hood1');
    INSERT INTO beers (venue_id, brand, size_05, updated, reports, price_observed_at, verified_at, serving_volume_ml)
      VALUES ('legacy-venue', 'Augustiner', 4.50, '2026-08-01', 3, '2026-08-01', '2026-09-01', 500);
  `);
  legacy.close();
}

const database = require('./db/database');
const { db } = database;
const { todayISO } = require('./utils/priceUtils');

const TODAY = todayISO();
const bak = (label) => fs.readdirSync(tmpDir).filter((f) => f.includes(`.pre-${label}-`) && f.endsWith('.bak'));
const beer = (id) => db.prepare('SELECT * FROM beers WHERE id = ?').get(id);
const beerId = (venueId, brand) => db.prepare('SELECT id FROM beers WHERE venue_id = ? AND brand = ?').get(venueId, brand).id;
const histRows = (venueId) => db.prepare('SELECT * FROM price_history WHERE venue_id = ? ORDER BY id').all(venueId);
let venueSeq = 0;
function makeVenue(beers, over = {}) {
  venueSeq += 1;
  return database.createVenue({ name: `P2 Venue ${venueSeq}`, type: 'bar', neighbourhood_id: 'hood1', ...over }, beers);
}
// A venue with one 0.5 L €4.50 beer whose freshness dates are set explicitly.
function fixture(dates = { obs: '2026-08-01', ver: '2026-09-01' }) {
  const vid = makeVenue([{ brand: 'Fix', size_05: 4.5, size_mass: null, serve_type: 'tap' }]);
  const id = beerId(vid, 'Fix');
  db.prepare('UPDATE beers SET price_observed_at = ?, verified_at = ?, updated = ? WHERE id = ?').run(dates.obs, dates.ver, '2025-06-01', id);
  return { vid, id };
}

after(() => { db.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('Phase 2 migration (Phase-1 database -> source/notes + new tables)', () => {
  test('adds source_type and notes as NULL; nothing else on the row moves', () => {
    const r = beer(beerId('legacy-venue', 'Augustiner'));
    assert.equal(r.source_type, null); // provenance is never guessed for old prices
    assert.equal(r.notes, null);
    assert.deepEqual([r.size_05, r.updated, r.reports, r.price_observed_at, r.verified_at, r.serving_volume_ml],
      [4.5, '2026-08-01', 3, '2026-08-01', '2026-09-01', 500]);
  });
  test('creates price_history and flag_dismissals, both empty (no invented backfill)', () => {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    assert.ok(names.includes('price_history'));
    assert.ok(names.includes('flag_dismissals'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM price_history').get().n, 0);
  });
  test('takes one phase-2 backup, which still has the OLD shape; a re-run is a no-op', () => {
    assert.equal(bak('phase2').length, 1);
    const copy = new Database(path.join(tmpDir, bak('phase2')[0]), { readonly: true });
    assert.ok(!copy.prepare('PRAGMA table_info(beers)').all().some((c) => c.name === 'source_type'));
    copy.close();
    const id = beerId('legacy-venue', 'Augustiner');
    db.prepare("UPDATE beers SET notes = 'keep me' WHERE id = ?").run(id);
    database.initSchema();
    assert.equal(beer(id).notes, 'keep me');
    assert.equal(bak('phase2').length, 1);
  });
});

describe('admin-only fields stay out of the public API', () => {
  test('source_type and notes are in the admin beer, never the public one', () => {
    const vid = makeVenue([{ brand: 'Priv', size_05: 5, source_type: 'MENU_PHOTO' }]);
    db.prepare("UPDATE beers SET notes = 'internal only' WHERE venue_id = ?").run(vid);
    const pub = database.getVenue(vid).beers[0];
    const adm = database.getVenueAdmin(vid).beers[0];
    assert.ok(!('notes' in pub) && !('source_type' in pub));
    assert.ok(!JSON.stringify(database.getVenue(vid)).includes('internal only'));
    assert.equal(adm.notes, 'internal only');
    assert.equal(adm.source_type, 'MENU_PHOTO');
  });
});

describe('price editor fields (Task 2)', () => {
  test('saving never sets verified_at — a changed price clears it, an unchanged one leaves it', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', notes: 'checked the menu' });
    assert.equal(beer(id).verified_at, '2026-09-01');  // untouched by a notes-only save
    database.updateBeerPrice(vid, id, { size_05: 4.8, size_mass: null, serve_type: 'tap' });
    assert.equal(beer(id).verified_at, null);           // cleared, NOT set
  });

  test('a price change with an explicit observed date + source uses them', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, {
      size_05: 4.8, size_mass: null, serve_type: 'tap', price_observed_at: '2026-09-05', source_type: 'MENU_PHOTO',
    }, { changedBy: 'sittan' });
    const r = beer(id);
    assert.deepEqual([r.size_05, r.price_observed_at, r.source_type, r.verified_at], [4.8, '2026-09-05', 'MENU_PHOTO', null]);
  });

  test('a price change with no date given is observed today and sourced from the admin', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.9, size_mass: null, serve_type: 'tap' });
    const r = beer(id);
    assert.deepEqual([r.price_observed_at, r.source_type], [TODAY, 'ADMIN']);
  });

  test('serving size can be changed; it is a change to the headline price', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', serving_volume_ml: 330 });
    const r = beer(id);
    assert.deepEqual([r.serving_volume_ml, r.price_observed_at, r.verified_at], [330, TODAY, null]);
    assert.equal(database.getVenueAdmin(vid).beers[0].normalized_500ml_price, 6.82);
  });

  test('an observed date given on its own is stored; a verification it supersedes is cleared', () => {
    const { vid, id } = fixture({ obs: '2026-08-01', ver: '2026-09-01' });
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', price_observed_at: '2026-09-10' });
    const r = beer(id);
    assert.deepEqual([r.price_observed_at, r.verified_at, r.updated], ['2026-09-10', null, TODAY]);
  });
  test('…but a verification NEWER than the given date is kept', () => {
    const { vid, id } = fixture({ obs: '2026-08-01', ver: '2026-09-01' });
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', price_observed_at: '2026-08-20' });
    const r = beer(id);
    assert.deepEqual([r.price_observed_at, r.verified_at], ['2026-08-20', '2026-09-01']);
  });

  test('source / notes alone touch only `updated`; notes are trimmed and blank clears them', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', source_type: 'VENUE', notes: '  called the bar  ' });
    let r = beer(id);
    assert.deepEqual([r.source_type, r.notes, r.updated, r.price_observed_at, r.verified_at], ['VENUE', 'called the bar', TODAY, '2026-08-01', '2026-09-01']);
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', notes: '   ' });
    assert.equal(beer(id).notes, null);
  });

  test('an unknown source_type is stored as unknown, not as garbage', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', source_type: 'PSYCHIC' });
    assert.equal(beer(id).source_type, null);
  });

  test('saving exactly what is already there writes nothing', () => {
    const { vid, id } = fixture();
    const before = beer(id);
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', price_observed_at: '2026-08-01', notes: '' });
    assert.deepEqual(beer(id), before);
  });
});

describe('price history rules (Tasks 3 + 4)', () => {
  test('Verify creates NO history entry, and changes no price or observation date', () => {
    const { vid, id } = fixture({ obs: '2026-08-01', ver: null });
    const before = beer(id);
    database.verifyBeerPrice(vid, id);
    const after = beer(id);
    assert.equal(histRows(vid).length, 0);
    assert.equal(after.verified_at, TODAY);
    assert.deepEqual({ ...after, verified_at: null }, { ...before, verified_at: null });
  });

  test('a no-op save, and a notes/source-only save, create no history entry', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap' });
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', notes: 'x', source_type: 'OTHER' });
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', price_observed_at: '2026-08-15' });
    assert.equal(histRows(vid).length, 0);
  });

  test('a real price change creates exactly ONE entry with price, size, date, source and who', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.8, size_mass: null, serve_type: 'tap', price_observed_at: '2026-09-05', source_type: 'MENU_PHOTO' }, { changedBy: 'sittan' });
    const rows = histRows(vid);
    assert.equal(rows.length, 1);
    assert.deepEqual(
      [rows[0].event, rows[0].price, rows[0].serving_volume_ml, rows[0].price_observed_at, rows[0].source_type, rows[0].changed_by, rows[0].beer_id],
      ['price_changed', 4.8, 500, '2026-09-05', 'MENU_PHOTO', 'sittan', id],
    );
  });

  test('a serving-size-only change is also an entry', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: null, serve_type: 'tap', serving_volume_ml: 400 });
    assert.equal(histRows(vid).length, 1);
    assert.equal(histRows(vid)[0].serving_volume_ml, 400);
  });

  test('adding a beer as an admin records its creation; a script-inserted one has no invented history', () => {
    const vid = makeVenue([{ brand: 'Scripted', size_05: 5 }]); // no record_history_by
    assert.equal(histRows(vid).length, 0);
    database.addBeerToVenue(vid, { brand: 'AdminAdded', size_05: 5.2, price_observed_at: TODAY, source_type: 'ADMIN', record_history_by: 'sittan' });
    const rows = histRows(vid);
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].event, rows[0].brand, rows[0].price, rows[0].changed_by, rows[0].source_type], ['created', 'AdminAdded', 5.2, 'sittan', 'ADMIN']);
  });

  const sub = (vid, over) => ({
    id: `sub-${Math.random().toString(36).slice(2, 8)}`, venue_id: vid, beer_brand: 'Fix', price: 4.9, size: '0.5L',
    visit_date: '2026-09-10', serve_type: null, submitter_name: 'Anna', ...over,
  });

  test('approving a submission: ONE entry (source COMMUNITY, by the submitter, dated by the visit), observed = visit date, NOT verified', () => {
    const { vid, id } = fixture();
    const s = sub(vid, {});
    database.applyApprovedPrice(s);
    const r = beer(id);
    assert.deepEqual([r.size_05, r.price_observed_at, r.verified_at, r.source_type], [4.9, '2026-09-10', null, 'COMMUNITY']);
    const rows = histRows(vid);
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].event, rows[0].source_type, rows[0].changed_by, rows[0].price_observed_at, rows[0].submission_id],
      ['approved_submission', 'COMMUNITY', 'Anna', '2026-09-10', s.id]);
  });

  test('approving a NEW beer records its creation from the submission', () => {
    const { vid } = fixture();
    const s = sub(vid, { beer_brand: 'Brandneu', price: 5.5 });
    database.applyApprovedPrice(s);
    const rows = histRows(vid).filter((h) => h.brand === 'Brandneu');
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].event, rows[0].submission_id, rows[0].changed_by], ['approved_submission', s.id, 'Anna']);
  });

  test('an unrecognised size writes no entry and changes no beer', () => {
    const { vid, id } = fixture();
    const before = beer(id);
    database.applyApprovedPrice(sub(vid, { size: '0.3L' }));
    assert.equal(histRows(vid).length, 0);
    assert.deepEqual(beer(id), before);
  });
});

describe('history viewer (Task 4)', () => {
  const insertSub = (row) => db.prepare(`
    INSERT INTO submissions (id, report_type, venue_id, venue_name, beer_brand, size, price, visit_date, submitter_name, note, status, created_at)
    VALUES (@id, 'price_change', @venue_id, 'v', @beer_brand, @size, @price, @visit_date, @submitter_name, @note, @status, @created_at)
  `).run({ note: '', submitter_name: 'Anna', created_at: new Date().toISOString(), ...row });

  test('null for a beer that is not at that venue', () => {
    const { id } = fixture();
    assert.equal(database.getBeerHistory('legacy-venue', id), null);
  });

  test('a beer with no recorded changes has an empty history (no invented rows)', () => {
    const { vid, id } = fixture();
    assert.deepEqual(database.getBeerHistory(vid, id).entries, []);
  });

  test('merges real changes with pending/rejected/legacy submissions, newest first, with the right status', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.8, size_mass: null, serve_type: 'tap', price_observed_at: '2026-09-05' }, { changedBy: 'sittan' });
    insertSub({ id: 'h-p', venue_id: vid, beer_brand: 'Fix', size: '0.5L', price: 5.5, visit_date: '2026-09-12', status: 'pending' });
    insertSub({ id: 'h-r', venue_id: vid, beer_brand: 'Fix', size: '0.33L', price: 3.9, visit_date: '2026-09-08', status: 'rejected' });
    insertSub({ id: 'h-a', venue_id: vid, beer_brand: 'fix', size: '0.5L', price: 4.2, visit_date: '2026-07-01', status: 'approved' }); // legacy approval, brand in another case
    const { entries } = database.getBeerHistory(vid, id);
    assert.deepEqual(entries.map((e) => [e.date, e.status, e.price]), [
      ['2026-09-12', 'pending', 5.5],
      ['2026-09-08', 'rejected', 3.9],
      ['2026-09-05', 'approved', 4.8],
      ['2026-07-01', 'approved', 4.2],
    ]);
    const rejected = entries.find((e) => e.status === 'rejected');
    assert.equal(rejected.serving_volume_ml, 330);
    assert.equal(rejected.normalized_500ml_price, 5.91);
    assert.equal(rejected.source_type, 'COMMUNITY');
  });

  test('seeded estimates are labelled and carry no fake attribution', () => {
    const { vid, id } = fixture();
    insertSub({ id: 'h-seed', venue_id: vid, beer_brand: 'Fix', size: '0.5L', price: 4.3, visit_date: '2026-03-01', status: 'approved', submitter_name: 'Community', note: database.SEEDED_ESTIMATE_NOTE });
    insertSub({ id: 'h-real', venue_id: vid, beer_brand: 'Fix', size: '0.5L', price: 4.4, visit_date: '2026-04-01', status: 'approved' });
    const { entries } = database.getBeerHistory(vid, id);
    const seeded = entries.find((e) => e.id === 'sh-seed');
    const real = entries.find((e) => e.id === 'sh-real');
    assert.equal(seeded.kind, 'seeded_estimate');
    assert.deepEqual([seeded.submitted_by, seeded.source_type], [null, null]);
    assert.equal(real.kind, 'observation');
    assert.equal(real.submitted_by, 'Anna');
  });

  test('an approval since Phase 2 shows ONCE (from price_history), not again as a submission', () => {
    const { vid, id } = fixture();
    insertSub({ id: 'once-1', venue_id: vid, beer_brand: 'Fix', size: '0.5L', price: 4.9, visit_date: '2026-09-10', status: 'approved' });
    database.applyApprovedPrice({ id: 'once-1', venue_id: vid, beer_brand: 'Fix', price: 4.9, size: '0.5L', visit_date: '2026-09-10', submitter_name: 'Anna' });
    const { entries } = database.getBeerHistory(vid, id);
    assert.equal(entries.filter((e) => e.price === 4.9).length, 1);
  });

  test('only the entry that IS the current price carries verified_at; Verify adds no row', () => {
    const { vid, id } = fixture({ obs: '2026-09-05', ver: null });
    database.updateBeerPrice(vid, id, { size_05: 4.8, size_mass: null, serve_type: 'tap', price_observed_at: '2026-09-05' });
    database.updateBeerPrice(vid, id, { size_05: 5.0, size_mass: null, serve_type: 'tap', price_observed_at: '2026-09-07' });
    database.verifyBeerPrice(vid, id);
    const { beer: b, entries } = database.getBeerHistory(vid, id);
    assert.equal(entries.length, 2); // verifying added nothing
    assert.equal(b.verified_at, TODAY);
    const current = entries.filter((e) => e.is_current);
    assert.equal(current.length, 1);
    assert.deepEqual([current[0].price, current[0].verified_at], [5.0, TODAY]);
    assert.equal(entries.find((e) => e.price === 4.8).verified_at, null);
  });

  test('an approved report with an unrecognised size is marked "not applied" — it never reached the price', () => {
    const { vid, id } = fixture();
    insertSub({ id: 'na-1', venue_id: vid, beer_brand: 'Fix', size: '0.3L', price: 3.0, visit_date: '2026-09-01', status: 'approved' });
    insertSub({ id: 'na-2', venue_id: vid, beer_brand: 'Fix', size: '0.33L', price: 3.5, visit_date: '2026-09-02', status: 'approved' });
    const { entries } = database.getBeerHistory(vid, id);
    assert.equal(entries.find((e) => e.id === 'sna-1').not_applied, true);
    assert.equal(entries.find((e) => e.id === 'sna-2').not_applied, false);
  });

  test('a seeded estimate is never treated as the current price', () => {
    const { vid, id } = fixture();
    insertSub({ id: 'seed-cur', venue_id: vid, beer_brand: 'Fix', size: '0.5L', price: 4.5, visit_date: '2026-06-01', status: 'approved', note: database.SEEDED_ESTIMATE_NOTE });
    assert.equal(database.getBeerHistory(vid, id).entries.filter((e) => e.is_current).length, 0);
  });
});

describe('flag dismissals (Task 1)', () => {
  test('a dismissed flag disappears for 7 days, then reappears by itself — nothing is fixed or deleted', () => {
    const vid = makeVenue([{ brand: 'Dis', size_05: 5 }]); // no observation date -> MISSING_OBSERVATION_DATE
    const id = beerId(vid, 'Dis');
    const has = (now) => database.getDataQuality(now).flags.some((f) => f.venue_id === vid && f.flag === 'MISSING_OBSERVATION_DATE' && f.beer_id === id);
    assert.equal(has(new Date()), true);

    const t0 = new Date('2026-09-20T10:00:00Z');
    const until = database.dismissFlag({ flag: 'MISSING_OBSERVATION_DATE', venue_id: vid, beer_id: id, by: 'sittan' }, t0);
    assert.equal(until, '2026-09-27T10:00:00.000Z');
    assert.equal(has(new Date('2026-09-20T10:00:01Z')), false);
    assert.equal(has(new Date('2026-09-26T23:59:00Z')), false);
    assert.equal(has(new Date('2026-09-27T10:00:01Z')), true, 'flag must reappear after 7 days');
    // the beer itself was never touched
    assert.deepEqual([beer(id).size_05, beer(id).verified_at, beer(id).price_observed_at], [5, null, null]);
  });

  test('dismissing one beer’s flag leaves the same flag on another beer', () => {
    const vid = makeVenue([{ brand: 'A', size_05: 5 }, { brand: 'B', size_05: 5 }]);
    const a = beerId(vid, 'A'); const b = beerId(vid, 'B');
    database.dismissFlag({ flag: 'MISSING_OBSERVATION_DATE', venue_id: vid, beer_id: a });
    const left = database.getDataQuality().flags.filter((f) => f.venue_id === vid && f.flag === 'MISSING_OBSERVATION_DATE');
    assert.deepEqual(left.map((f) => f.beer_id), [b]);
  });

  test('re-dismissing extends the window instead of failing', () => {
    const vid = makeVenue([{ brand: 'R', size_05: 5 }]);
    const id = beerId(vid, 'R');
    database.dismissFlag({ flag: 'MISSING_OBSERVATION_DATE', venue_id: vid, beer_id: id }, new Date('2026-09-20T00:00:00Z'));
    const until = database.dismissFlag({ flag: 'MISSING_OBSERVATION_DATE', venue_id: vid, beer_id: id }, new Date('2026-09-25T00:00:00Z'));
    assert.equal(until, '2026-10-02T00:00:00.000Z');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM flag_dismissals WHERE venue_id = ?').get(vid).n, 1);
  });

  test('deleting a venue removes its history and dismissals', () => {
    const vid = makeVenue([{ brand: 'Del', size_05: 5, record_history_by: 'x', source_type: 'ADMIN' }]);
    database.dismissFlag({ flag: 'DUPLICATE_VENUE', venue_id: vid, beer_id: 0 });
    assert.equal(histRows(vid).length, 1);
    database.deleteVenue(vid);
    assert.equal(histRows(vid).length, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM flag_dismissals WHERE venue_id = ?').get(vid).n, 0);
  });
});

describe('submission review view (Task 6)', () => {
  const pending = (id, vid, over) => db.prepare(`
    INSERT INTO submissions (id, report_type, venue_id, venue_name, beer_brand, size, price, visit_date, submitter_name, status, is_outlier, created_at)
    VALUES (?, 'price_change', ?, 'v', ?, ?, ?, '2026-09-10', 'Anna', 'pending', 0, datetime('now'))
  `).run(id, vid, over.brand ?? 'Fix', over.size, over.price);
  const view = (id) => database.getAdminSubmissions('pending').find((s) => s.id === id);

  test('shows the submitted price at its size, per 0.5 L, the current price, and the difference', () => {
    const { vid } = fixture(); // current: €4.50 @ 0.5 L
    pending('rv-1', vid, { size: '0.33L', price: 3.5 }); // ≈ €5.30 per 0.5 L
    const s = view('rv-1');
    assert.equal(s.serving_volume_ml, 330);
    assert.equal(s.normalized_500ml_price, 5.3);
    assert.equal(s.source_type, 'COMMUNITY');
    assert.equal(s.current.price, 4.5);
    assert.equal(s.current.normalized_500ml_price, 4.5);
    assert.equal(s.difference_pct, 17.8);
    assert.equal(s.outlier, false); // +17.8% is within 25%
  });

  test('flags a submission more than 25% away from the current price — in either direction', () => {
    const { vid } = fixture();
    pending('rv-hi', vid, { size: '0.5L', price: 6.0 });   // +33.3%
    pending('rv-lo', vid, { size: '0.5L', price: 3.0 });   // -33.3%
    pending('rv-edge', vid, { size: '0.5L', price: 5.6 }); // +24.4%
    assert.deepEqual([view('rv-hi').outlier, view('rv-lo').outlier, view('rv-edge').outlier], [true, true, false]);
    assert.equal(view('rv-hi').difference_pct, 33.3);
  });

  test('the outlier flag is judged against the CURRENT price, not the price when it was submitted', () => {
    const { vid, id } = fixture();
    pending('rv-live', vid, { size: '0.5L', price: 6.0 });
    assert.equal(view('rv-live').outlier, true);
    database.updateBeerPrice(vid, id, { size_05: 5.9, size_mass: null, serve_type: 'tap' });
    assert.equal(view('rv-live').outlier, false);
  });

  test('an unrecognised size is called out and gets no comparison price', () => {
    const { vid } = fixture();
    pending('rv-bad', vid, { size: '0.3L', price: 3.0 });
    const s = view('rv-bad');
    assert.deepEqual([s.size_valid, s.serving_volume_ml, s.normalized_500ml_price, s.difference_pct, s.outlier], [false, null, null, null, false]);
  });

  test('a beer the venue does not list has no current price to compare with', () => {
    const { vid } = fixture();
    pending('rv-new', vid, { brand: 'Unlisted', size: '0.5L', price: 5 });
    const s = view('rv-new');
    assert.deepEqual([s.current, s.difference_pct, s.outlier], [null, null, false]);
  });

  test('reports the current price’s freshness so a reviewer sees how much to trust it', () => {
    const { vid } = fixture({ obs: null, ver: null });
    pending('rv-fr', vid, { size: '0.5L', price: 4.6 });
    assert.equal(view('rv-fr').current.freshness_state, 'UNKNOWN');
  });
});
