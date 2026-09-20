// Database-level tests for the price-trust rules: the Phase 1 migration, the
// admin save / verify split, submission approval and the derived API fields.
// Runs against a throwaway SQLite file (never bierpreis.db) that is first built
// in the LEGACY shape — a beers table without the new columns — so the real
// migration path is what gets exercised.
//   node --test backend/pricesDb.test.js
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bierpreis-pricesdb-'));
const dbFile = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbFile;

// ── Legacy database: the schema as it was BEFORE Phase 1, with real-looking rows.
{
  const legacy = new Database(dbFile);
  legacy.exec(`
    CREATE TABLE neighbourhoods (
      id TEXT PRIMARY KEY, name_de TEXT NOT NULL, name_en TEXT NOT NULL,
      short_name_de TEXT, short_name_en TEXT, center_lat REAL, center_lng REAL,
      description_de TEXT, description_en TEXT, city_id INTEGER DEFAULT 1
    );
    CREATE TABLE venues (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      neighbourhood_id TEXT NOT NULL REFERENCES neighbourhoods(id),
      address TEXT, lat REAL, lng REAL, opening_hours TEXT, website TEXT,
      description_de TEXT, description_en TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      outside_modelled_area INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE beers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      brand TEXT NOT NULL, size_05 REAL, size_mass REAL, updated TEXT,
      reports INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
      serve_type TEXT NOT NULL DEFAULT 'unknown'
    );
    INSERT INTO neighbourhoods (id, name_de, name_en) VALUES ('hood1', 'Hood 1', 'Hood 1');
    INSERT INTO venues (id, name, type, neighbourhood_id) VALUES ('legacy-venue', 'Legacy Venue', 'bar', 'hood1');
    INSERT INTO beers (venue_id, brand, size_05, size_mass, updated, reports, serve_type)
      VALUES ('legacy-venue', 'Augustiner', 4.50, 9.00, '2025-06-01', 8, 'tap'),
             ('legacy-venue', 'Paulaner',   5.20, NULL, '2026-09-13', 3, 'unknown');
  `);
  legacy.close();
}

// Requiring the module opens the DB and runs the migration.
const database = require('./db/database');
const { db } = database;
const { todayISO } = require('./utils/priceUtils');

const TODAY = todayISO();
const bak = () => fs.readdirSync(tmpDir).filter((f) => f.includes('.pre-phase1-') && f.endsWith('.bak'));
const beer = (id) => db.prepare('SELECT * FROM beers WHERE id = ?').get(id);
const beerId = (venueId, brand) => db.prepare('SELECT id FROM beers WHERE venue_id = ? AND brand = ?').get(venueId, brand).id;
let venueSeq = 0;
// A fresh venue with the given beers, so each test starts from a known state.
function makeVenue(beers) {
  venueSeq += 1;
  return database.createVenue({ name: `Test Venue ${venueSeq}`, type: 'bar', neighbourhood_id: 'hood1' }, beers);
}

after(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Phase 1 migration (legacy database -> price-trust columns)', () => {
  test('adds price_observed_at, verified_at and serving_volume_ml', () => {
    const cols = db.prepare('PRAGMA table_info(beers)').all().map((c) => c.name);
    for (const c of ['price_observed_at', 'verified_at', 'serving_volume_ml']) assert.ok(cols.includes(c), `missing ${c}`);
  });

  test('every existing row gets NULL for BOTH new dates — nothing is copied from `updated`', () => {
    const rows = db.prepare('SELECT * FROM beers WHERE venue_id = ?').all('legacy-venue');
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.price_observed_at, null);
      assert.equal(r.verified_at, null);
    }
  });

  test('serving_volume_ml is backfilled to 500 (size_05 is the 0.5 L price)', () => {
    for (const r of db.prepare('SELECT serving_volume_ml FROM beers WHERE venue_id = ?').all('legacy-venue')) {
      assert.equal(r.serving_volume_ml, 500);
    }
  });

  test('prices, `updated` and `reports` are untouched', () => {
    const a = beer(beerId('legacy-venue', 'Augustiner'));
    assert.deepEqual([a.size_05, a.size_mass, a.updated, a.reports, a.serve_type], [4.5, 9.0, '2025-06-01', 8, 'tap']);
    const p = beer(beerId('legacy-venue', 'Paulaner'));
    assert.deepEqual([p.size_05, p.size_mass, p.updated, p.reports], [5.2, null, '2026-09-13', 3]);
  });

  test('a backup is written before the schema changes', () => {
    assert.equal(bak().length, 1);
    const copy = new Database(path.join(tmpDir, bak()[0]), { readonly: true });
    const cols = copy.prepare('PRAGMA table_info(beers)').all().map((c) => c.name);
    assert.ok(!cols.includes('verified_at'), 'the backup must hold the pre-migration schema');
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM beers').get().n, 2);
    copy.close();
  });

  test('re-running it is a no-op: no second backup, and real data is not reset', () => {
    const id = beerId('legacy-venue', 'Augustiner');
    db.prepare('UPDATE beers SET verified_at = ?, serving_volume_ml = 330 WHERE id = ?').run('2026-09-01', id);
    database.initSchema();
    database.initSchema();
    const r = beer(id);
    assert.equal(r.verified_at, '2026-09-01', 'verified_at must survive a later boot');
    assert.equal(r.serving_volume_ml, 330, 'the 500 backfill must not run again');
    assert.equal(bak().length, 1);
    db.prepare('UPDATE beers SET verified_at = NULL, serving_volume_ml = 500 WHERE id = ?').run(id);
  });
});

describe('API beer shape', () => {
  test('carries the new fields and the server-derived values', () => {
    const b = database.getVenue('legacy-venue').beers.find((x) => x.brand === 'Augustiner');
    assert.equal(b.price_observed_at, null);
    assert.equal(b.verified_at, null);
    assert.equal(b.serving_volume_ml, 500);
    assert.equal(b.normalized_500ml_price, 4.5);
    assert.equal(b.freshness_state, 'UNKNOWN'); // legacy price: no observation, no verification
  });

  test('exposes no private fields', () => {
    const b = database.getVenue('legacy-venue').beers[0];
    assert.deepEqual(Object.keys(b).sort(), [
      'brand', 'freshness_state', 'id', 'normalized_500ml_price', 'price_observed_at', 'reports',
      'serve_type', 'serving_volume_ml', 'size_05', 'size_mass', 'updated', 'venue_id', 'verified_at',
    ]);
  });

  test('a beer with an unknown serving size has no normalized price (not the raw price)', () => {
    const vid = makeVenue([{ brand: 'Mystery', size_05: 4.2, serving_volume_ml: null }]);
    const b = database.getVenue(vid).beers[0];
    assert.equal(b.serving_volume_ml, null);
    assert.equal(b.normalized_500ml_price, null);
  });

  test('freshness_state ignores the technical `updated` column', () => {
    const id = beerId('legacy-venue', 'Paulaner'); // no observation, no verification
    db.prepare('UPDATE beers SET updated = ? WHERE id = ?').run('2020-01-01', id);
    const before = database.getVenue('legacy-venue').beers.find((x) => x.id === id).freshness_state;
    db.prepare('UPDATE beers SET updated = ? WHERE id = ?').run(TODAY, id);
    const after = database.getVenue('legacy-venue').beers.find((x) => x.id === id).freshness_state;
    assert.equal(before, 'UNKNOWN');
    assert.equal(after, 'UNKNOWN');
    db.prepare('UPDATE beers SET updated = ? WHERE id = ?').run('2026-09-13', id);
  });

  test('beers[0] is the cheapest per 0.5 L; an unknown serving size sorts last', () => {
    const vid = makeVenue([
      { brand: 'Small', size_05: 3.5, serving_volume_ml: 330 },   // ≈ €5.30 per 0.5 L
      { brand: 'Half', size_05: 4.2, serving_volume_ml: 500 },
      { brand: 'Unknown', size_05: 1.0, serving_volume_ml: null }, // lowest raw number, but not comparable
    ]);
    assert.deepEqual(database.getVenue(vid).beers.map((b) => b.brand), ['Half', 'Small', 'Unknown']);
  });
});

describe('admin save vs verify (Task 2)', () => {
  function fixture() {
    const vid = makeVenue([{ brand: 'Fix', size_05: 4.5, size_mass: 9.0, serve_type: 'tap' }]);
    const id = beerId(vid, 'Fix');
    // A known, old technical date and a known observation, so any change is visible.
    db.prepare(`UPDATE beers SET updated = '2025-06-01', price_observed_at = '2026-08-01', verified_at = NULL WHERE id = ?`).run(id);
    return { vid, id };
  }

  test('saving with nothing changed writes nothing — `updated` and the dates stay put', () => {
    const { vid, id } = fixture();
    const before = beer(id);
    assert.equal(database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: 9.0, serve_type: 'tap' }), true);
    assert.deepEqual(beer(id), before);
    // …and an omitted serve_type / volume also means "leave as is".
    assert.equal(database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: 9.0 }), true);
    assert.deepEqual(beer(id), before);
  });

  test('changing only the serve type bumps `updated` but not the freshness dates', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: 9.0, serve_type: 'bottle' });
    const r = beer(id);
    assert.equal(r.serve_type, 'bottle');
    assert.equal(r.updated, TODAY);
    assert.equal(r.price_observed_at, '2026-08-01');
    assert.equal(r.verified_at, null);
  });

  test('changing only the 1 L price bumps `updated` but not the freshness dates', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: 9.4, serve_type: 'tap' });
    const r = beer(id);
    assert.equal(r.size_mass, 9.4);
    assert.equal(r.updated, TODAY);
    assert.equal(r.price_observed_at, '2026-08-01');
  });

  test('a real price change: new observation today, the earlier verification is cleared', () => {
    const { vid, id } = fixture();
    db.prepare(`UPDATE beers SET verified_at = '2026-08-15' WHERE id = ?`).run(id);
    database.updateBeerPrice(vid, id, { size_05: 4.8, size_mass: 9.0, serve_type: 'tap' });
    const r = beer(id);
    assert.equal(r.size_05, 4.8);
    assert.equal(r.updated, TODAY);
    assert.equal(r.price_observed_at, TODAY);
    assert.equal(r.verified_at, null);
  });

  test('changing the serving size counts as a change to the headline price', () => {
    const { vid, id } = fixture();
    database.updateBeerPrice(vid, id, { size_05: 4.5, size_mass: 9.0, serve_type: 'tap', serving_volume_ml: 400 });
    const r = beer(id);
    assert.equal(r.serving_volume_ml, 400);
    assert.equal(r.price_observed_at, TODAY);
  });

  test('verify sets verified_at = today and nothing else', () => {
    const { vid, id } = fixture();
    const before = beer(id);
    const submissionsBefore = db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n;

    const result = database.verifyBeerPrice(vid, id);
    assert.equal(result.verified_at, TODAY);

    const after = beer(id);
    assert.equal(after.verified_at, TODAY);
    assert.deepEqual({ ...after, verified_at: null }, { ...before, verified_at: null },
      'price, volume, price_observed_at, updated and reports must all be untouched');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, submissionsBefore,
      'verifying creates no price-history entry');
    assert.equal(database.getVenue(vid).beers[0].freshness_state, 'FRESH');
  });

  test('verify: unknown beer / other venue / beer without a price', () => {
    const { vid, id } = fixture();
    assert.equal(database.verifyBeerPrice(vid, 999999), 'not_found');
    assert.equal(database.verifyBeerPrice('legacy-venue', id), 'not_found'); // beer belongs to another venue
    db.prepare('UPDATE beers SET size_05 = NULL WHERE id = ?').run(id);
    assert.equal(database.verifyBeerPrice(vid, id), 'no_price');
    assert.equal(beer(id).verified_at, null);
  });
});

describe('creating beers — no invented observation dates', () => {
  test('a beer created without a date has NULL price_observed_at / verified_at and a 500 ml default', () => {
    const vid = makeVenue([{ brand: 'Scripted', size_05: 5.0 }]);
    const r = beer(beerId(vid, 'Scripted'));
    assert.equal(r.price_observed_at, null);
    assert.equal(r.verified_at, null);
    assert.equal(r.serving_volume_ml, 500);
    assert.equal(r.updated, TODAY);
  });
  test('a caller that can vouch for the date passes it', () => {
    const vid = makeVenue([{ brand: 'Vouched', size_05: 5.0, price_observed_at: '2026-09-10' }]);
    assert.equal(beer(beerId(vid, 'Vouched')).price_observed_at, '2026-09-10');
  });
  test('an unusable date is dropped, not stored', () => {
    const vid = makeVenue([{ brand: 'BadDate', size_05: 5.0, price_observed_at: 'yesterday' }]);
    assert.equal(beer(beerId(vid, 'BadDate')).price_observed_at, null);
  });
});

describe('approving a submission (Task 3)', () => {
  function fixture() {
    const vid = makeVenue([{ brand: 'Approve', size_05: 4.5, size_mass: null, serve_type: 'unknown' }]);
    const id = beerId(vid, 'Approve');
    db.prepare(`UPDATE beers SET updated = '2025-06-01', reports = 4, price_observed_at = '2026-07-01', verified_at = '2026-08-01' WHERE id = ?`).run(id);
    return { vid, id };
  }
  const sub = (vid, over) => ({ venue_id: vid, beer_brand: 'Approve', price: 4.9, size: '0.5L', visit_date: '2026-09-10', serve_type: null, ...over });

  test('an unrecognised size writes NOTHING — no price, no `updated`, no `reports`', () => {
    for (const size of ['0.3L', '2L', '', null, undefined, 'abc']) {
      const { vid, id } = fixture();
      const before = beer(id);
      const out = database.applyApprovedPrice(sub(vid, { size }));
      assert.deepEqual(out, { applied: false, reason: 'invalid_size' }, `size ${JSON.stringify(size)}`);
      assert.deepEqual(beer(id), before, `size ${JSON.stringify(size)} must not touch the row`);
    }
  });

  test('an unusable price writes nothing either', () => {
    const { vid, id } = fixture();
    const before = beer(id);
    for (const price of [null, 0, -2, NaN]) {
      assert.equal(database.applyApprovedPrice(sub(vid, { price })).applied, false);
    }
    assert.deepEqual(beer(id), before);
  });

  test('0.5 L: updates the headline; price_observed_at = the visit date; the old verification is cleared', () => {
    const { vid, id } = fixture();
    const out = database.applyApprovedPrice(sub(vid, { serve_type: 'tap' }));
    assert.equal(out.applied, true);
    const r = beer(id);
    assert.equal(r.size_05, 4.9);
    assert.equal(r.serving_volume_ml, 500);
    assert.equal(r.price_observed_at, '2026-09-10');
    assert.equal(r.verified_at, null);
    assert.equal(r.reports, 5);
    assert.equal(r.updated, TODAY);
    assert.equal(r.serve_type, 'tap');
  });

  test('the visit date — not today — is what freshness is based on', () => {
    const { vid, id } = fixture();
    database.applyApprovedPrice(sub(vid, { price: 4.9, visit_date: '2026-01-15' }));
    assert.equal(beer(id).price_observed_at, '2026-01-15');
    assert.equal(database.getVenue(vid).beers[0].freshness_state, 'STALE');
  });

  test('an unusable stored visit date leaves the observation date unchanged (never invented)', () => {
    const { vid, id } = fixture();
    database.applyApprovedPrice(sub(vid, { price: 4.9, visit_date: 'garbage' }));
    const r = beer(id);
    assert.equal(r.size_05, 4.9);
    assert.equal(r.price_observed_at, '2026-07-01');
  });

  test('0.5 L, same price, later date: a confirmation — observation moves forward, older verification superseded', () => {
    const { vid, id } = fixture();
    database.applyApprovedPrice(sub(vid, { price: 4.5, visit_date: '2026-09-10' }));
    const r = beer(id);
    assert.equal(r.price_observed_at, '2026-09-10');
    assert.equal(r.verified_at, null);
    assert.equal(r.reports, 5);
  });

  test('1 L (Maß): stored as size_mass; the headline price and its dates are untouched', () => {
    const { vid, id } = fixture();
    const out = database.applyApprovedPrice(sub(vid, { price: 9.6, size: '1L' }));
    assert.deepEqual([out.applied, out.target], [true, 'mass']);
    const r = beer(id);
    assert.equal(r.size_mass, 9.6);
    assert.equal(r.size_05, 4.5);
    assert.equal(r.price_observed_at, '2026-07-01');
    assert.equal(r.verified_at, '2026-08-01');
    assert.equal(r.reports, 5);
  });

  test('0.33 L: replaces the headline at that serving size and reports what it displaced', () => {
    const { vid, id } = fixture();
    const out = database.applyApprovedPrice(sub(vid, { price: 3.5, size: '0.33L' }));
    assert.equal(out.applied, true);
    assert.equal(out.old.size_05, 4.5);
    assert.equal(out.old.serving_volume_ml, 500);
    const r = beer(id);
    assert.deepEqual([r.size_05, r.serving_volume_ml, r.price_observed_at], [3.5, 330, '2026-09-10']);
    assert.equal(database.getVenue(vid).beers[0].normalized_500ml_price, 5.3);
  });

  test('a new beer: stored as reported at its reported size — a 1 L price is NOT halved into a 0.5 L price', () => {
    const { vid } = fixture();
    const out = database.applyApprovedPrice(sub(vid, { beer_brand: 'Brandneu', price: 9.0, size: '1L', serve_type: 'tap' }));
    assert.deepEqual([out.applied, out.created], [true, true]);
    const r = beer(beerId(vid, 'Brandneu'));
    assert.equal(r.size_05, 9.0);
    assert.equal(r.serving_volume_ml, 1000);
    assert.equal(r.size_mass, null);
    assert.equal(r.price_observed_at, '2026-09-10');
    assert.equal(r.verified_at, null);
    assert.equal(r.serve_type, 'tap');
    assert.equal(database.getVenue(vid).beers.find((b) => b.brand === 'Brandneu').normalized_500ml_price, 4.5);
  });

  test('a new beer at an invalid size is not created', () => {
    const { vid } = fixture();
    const before = db.prepare('SELECT COUNT(*) AS n FROM beers WHERE venue_id = ?').get(vid).n;
    assert.equal(database.applyApprovedPrice(sub(vid, { beer_brand: 'Nope', size: '0.3L' })).applied, false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM beers WHERE venue_id = ?').get(vid).n, before);
  });

  test('a displaced 1 L headline price is kept in size_mass, not lost', () => {
    const vid = makeVenue([{ brand: 'Maß', size_05: 9.0, serving_volume_ml: 1000 }]);
    database.applyApprovedPrice(sub(vid, { beer_brand: 'Maß', price: 4.6, size: '0.5L' }));
    const r = beer(beerId(vid, 'Maß'));
    assert.deepEqual([r.size_05, r.serving_volume_ml, r.size_mass], [4.6, 500, 9.0]);
  });
});

describe('aggregates compare normalized prices', () => {
  test('a neighbourhood average uses per-0.5 L prices and skips unknown serving sizes', () => {
    db.prepare(`INSERT INTO neighbourhoods (id, name_de, name_en, city_id) VALUES ('hood2', 'Hood 2', 'Hood 2', 1)`).run();
    const mk = (name, beers) => database.createVenue({ name, type: 'bar', neighbourhood_id: 'hood2' }, beers);
    mk('Avg A', [{ brand: 'X', size_05: 4.0 }]);                             // 4.00 per 0.5 L
    mk('Avg B', [{ brand: 'X', size_05: 3.3, serving_volume_ml: 330 }]);     // 5.00 per 0.5 L
    mk('Avg C', [{ brand: 'X', size_05: 1.0, serving_volume_ml: null }]);    // unknown size: excluded
    const hood = database.getNeighbourhoods().find((n) => n.id === 'hood2');
    assert.equal(hood.avg_price, 4.5);          // not (4 + 3.3 + 1) / 3
    assert.equal(hood.venue_count, 2);
  });
});

describe('public price history (Task 7: no private data)', () => {
  test('returns an allow-list of fields — no submitter, note or reject reason', () => {
    const vid = makeVenue([{ brand: 'Hist', size_05: 4.5 }]);
    db.prepare(`
      INSERT INTO submissions (id, report_type, venue_id, venue_name, beer_brand, size, price, visit_date,
                               submitter_name, note, status, reject_reason)
      VALUES ('t-hist-1', 'price_change', ?, 'X', 'Hist', '0.33L', 3.5, '2026-09-01',
              'Secret Person', 'private note', 'approved', 'internal')
    `).run(vid);
    const rows = database.getPublicPriceHistory(vid);
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['beer_brand', 'normalized_500ml_price', 'price', 'size', 'visit_date']);
    assert.equal(rows[0].price, 3.5);
    assert.equal(rows[0].normalized_500ml_price, 5.3);
    assert.ok(!JSON.stringify(rows).includes('Secret'));
  });
});
