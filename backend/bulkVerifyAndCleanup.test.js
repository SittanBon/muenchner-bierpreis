// Route-level tests for the two "before Phase 3" admin tasks, against the REAL
// server booted twice on a throwaway database:
//   1. boot-time removal of the fabricated "seeded price-trend history"
//      submissions (and the submission-id fix that removal makes necessary);
//   2. POST /api/admin/bulk-verify — scope, "only verified_at changes",
//      confirmation, audit log and the Telegram message.
// Telegram goes through backend/testSupport/telegramStub.js (fake token), so
// nothing can reach a real bot even though the project's .env configures one.
//   node --test backend/bulkVerifyAndCleanup.test.js
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { todayISO } = require('./utils/priceUtils');
const SEEDED_NOTE_FOR_TESTS = 'seeded price-trend history';

const ROOT = path.join(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bierpreis-bulk-'));
const dbFile = path.join(tmpDir, 'bulk.db');
const stubFile = path.join(tmpDir, 'telegram.log');
const CREDS = { username: 'tester', password: 'test-password-123' };
const TODAY = todayISO();

let base;
let server;
let token;
let output = '';

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on('error', reject);
});

async function boot() {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  output = '';
  server = spawn('node', ['--require', path.join(__dirname, 'testSupport', 'telegramStub.js'), 'server.js'], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), DATABASE_PATH: dbFile, NODE_ENV: 'development',
      ADMIN_USERNAME: CREDS.username, ADMIN_PASSWORD: CREDS.password, JWT_SECRET: 'test-jwt-secret',
      TELEGRAM_BOT_TOKEN: '000000:fake-test-token', TELEGRAM_CHAT_ID: '1', TELEGRAM_STUB_FILE: stubFile,
    },
  });
  server.stdout.on('data', (d) => { output += d; });
  server.stderr.on('data', (d) => { output += d; });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/api/stats`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const login = await post('/api/admin/login', CREDS, '');
  assert.equal(login.status, 200, `server failed to boot/login. Output:\n${output.slice(-1500)}`);
  token = login.body.token;
}
const stop = () => new Promise((resolve) => { server.once('exit', resolve); server.kill(); });

async function call(method, url, body, auth = token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}
const get = (url, auth) => call('GET', url, undefined, auth);
const post = (url, body, auth) => call('POST', url, body, auth);

const telegramMessages = () => (fs.existsSync(stubFile)
  ? fs.readFileSync(stubFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).text)
  : []);
const withDb = (fn) => { const d = new Database(dbFile); try { return fn(d); } finally { d.close(); } };
const logs = async (action) => {
  const r = (await get(`/api/admin/logs?action_type=${action}`)).body;
  return r.logs || r.rows || r.items || r;
};

// Rows the scenario is built from (ids filled in by the setup below).
const seededIds = [];
const real = {};   // the venues/beers picked for the scenario
let expectedCount;
let before_;       // snapshot of every beer row before the bulk verify

before(async () => {
  await boot();       // boot #1 seeds the database
  await stop();

  // ── Scenario, written straight into the database while the server is down.
  withDb((d) => {
    const ins = d.prepare(`INSERT INTO submissions (id, report_type, venue_id, venue_name, beer_brand, size, price, visit_date, submitter_name, note, status)
                           VALUES (?, 'price_change', ?, ?, 'Augustiner', '0.5L', 4.5, ?, ?, ?, 'approved')`);
    const anyVenue = d.prepare('SELECT id, name FROM venues WHERE active = 1 LIMIT 1').get();
    for (let i = 1; i <= 36; i++) {
      const id = `h${String(i).padStart(4, '0')}`;
      seededIds.push(id);
      ins.run(id, anyVenue.id, anyVenue.name, '2026-05-01', 'Community', SEEDED_NOTE_FOR_TESTS);
    }
    // Real submissions that must survive, holding the high s-numbers the live DB has.
    for (const id of ['s037', 's041']) ins.run(id, anyVenue.id, anyVenue.name, '2026-09-01', 'Anonym', 'a real note');
    real.venueId = anyVenue.id;

    // Bulk-verify scenario on top of the seeded data (all beers start unverified):
    const venues = d.prepare('SELECT id FROM venues WHERE active = 1 ORDER BY id').all();
    const beersOf = (vid) => d.prepare('SELECT id FROM beers WHERE venue_id = ? ORDER BY id').all(vid);
    // A technical-modification date that is NOT today, so a bulk verify that
    // (wrongly) bumped `updated` would be visible in the before/after comparison.
    d.prepare("UPDATE beers SET updated = '2026-01-01'").run();
    // (a) one venue hidden from the public site -> its beers are out of scope
    real.hiddenVenue = venues[0].id;
    d.prepare('UPDATE venues SET active = 0 WHERE id = ?').run(real.hiddenVenue);
    // (b) one delisted beer on a live venue
    real.delistedBeer = beersOf(venues[1].id)[0].id;
    d.prepare('UPDATE beers SET active = 0 WHERE id = ?').run(real.delistedBeer);
    // (c) one beer with no price at all
    real.noPriceBeer = beersOf(venues[2].id)[0].id;
    d.prepare('UPDATE beers SET size_05 = NULL WHERE id = ?').run(real.noPriceBeer);
    // (d) one beer already verified on an earlier date — must keep that date
    real.verifiedBeer = beersOf(venues[3].id)[0].id;
    d.prepare("UPDATE beers SET verified_at = '2026-08-01' WHERE id = ?").run(real.verifiedBeer);
    // (e) a beer with a real observation date — verifying must not touch it
    real.observedBeer = beersOf(venues[4].id)[0].id;
    d.prepare("UPDATE beers SET price_observed_at = '2026-07-15' WHERE id = ?").run(real.observedBeer);

    // Independent expectation: priced, delisted-free beers on live venues with no verification.
    const all = d.prepare('SELECT b.id, b.size_05, b.active, b.verified_at, v.active AS v_active FROM beers b JOIN venues v ON v.id = b.venue_id').all();
    expectedCount = all.filter((b) => b.verified_at == null && b.size_05 > 0 && b.active === 1 && b.v_active === 1).length;
  });

  await boot();       // boot #2: the cleanup runs during this boot
  before_ = withDb((d) => d.prepare('SELECT * FROM beers ORDER BY id').all());
});

after(async () => {
  try { await stop(); } catch { /* already down */ }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('boot-time removal of seeded price-trend submissions', () => {
  test('the server log reports exactly the 36 deleted rows', () => {
    assert.match(output, /Removed 36 fabricated "seeded price-trend history" submissions/);
  });

  test('every seeded row is gone and the real submissions are untouched', () => {
    withDb((d) => {
      assert.equal(d.prepare("SELECT COUNT(*) AS n FROM submissions WHERE note LIKE '%seeded price-trend history%'").get().n, 0);
      assert.deepEqual(d.prepare('SELECT id FROM submissions ORDER BY id').all().map((r) => r.id), ['s037', 's041']);
    });
  });

  test('a consistent backup with the deleted rows was written first', () => {
    const baks = fs.readdirSync(tmpDir).filter((f) => f.includes('.pre-remove-seeded-submissions-') && f.endsWith('.bak'));
    assert.equal(baks.length, 1);
    const b = new Database(path.join(tmpDir, baks[0]), { readonly: true });
    assert.equal(b.prepare("SELECT COUNT(*) AS n FROM submissions WHERE note LIKE '%seeded price-trend history%'").get().n, 36);
    b.close();
  });

  test('it is audited (as "system") with the count and ids', async () => {
    const [entry] = await logs('DELETE_SEEDED_SUBMISSIONS');
    assert.ok(entry, 'a DELETE_SEEDED_SUBMISSIONS entry');
    assert.equal(entry.performed_by, 'system');
    assert.equal(entry.details.deleted, 36);
    assert.deepEqual(entry.details.ids, seededIds);
  });

  test('the public Price Trends endpoints no longer contain the invented history', async () => {
    // The seeded rows were all dated 2026-05; the two real submissions are 2026-09.
    const t = await get('/api/stats/trends', '');
    assert.equal(t.status, 200);
    const text = JSON.stringify(t.body);
    assert.ok(!text.includes('2026-05'), 'no data point from the deleted seeded rows');
    assert.ok(text.includes('2026-09'), 'the real 2026-09 submissions still feed the chart');
  });

  test('a second boot is a silent no-op (no second backup, no second audit entry)', async () => {
    await stop();
    await boot();
    assert.doesNotMatch(output, /Removed \d+ fabricated/);
    assert.equal(fs.readdirSync(tmpDir).filter((f) => f.includes('.pre-remove-seeded-submissions-')).length, 1);
    assert.equal((await logs('DELETE_SEEDED_SUBMISSIONS')).length, 1);
  });

  test('new submission ids continue after the highest existing one — no collision with s037/s041', async () => {
    const venue = (await get('/api/venues', '')).body.find((v) => v.beers.length && v.beers[0].serving_volume_ml === 500);
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const r = await post('/api/submissions', {
        report_type: 'price_change', venue_id: venue.id, beer_brand: venue.beers[0].brand, price: venue.beers[0].size_05,
        size: '0.5L', serve_type: 'tap',
      }, '');
      assert.equal(r.status, 201, JSON.stringify(r.body));
      ids.push(r.body.id);
    }
    // Only 2 rows existed (a row COUNT would have issued s003, s004).
    assert.deepEqual(ids, ['s042', 's043']);
  });
});

describe('POST /api/admin/bulk-verify', () => {
  test('requires authentication', async () => {
    assert.equal((await post('/api/admin/bulk-verify', { confirm: true }, '')).status, 401);
    assert.equal((await post('/api/admin/bulk-verify', { confirm: true }, 'not.a.token')).status, 401);
  });

  test('refuses without an explicit confirm:true and changes nothing', async () => {
    for (const body of [{}, { confirm: 'yes' }, { confirm: false }]) {
      assert.equal((await post('/api/admin/bulk-verify', body)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual(withDb((d) => d.prepare('SELECT * FROM beers ORDER BY id').all()), before_);
    assert.equal((await logs('BULK_VERIFY')).length, 0);
    assert.deepEqual(telegramMessages().filter((m) => /Bulk verify/.test(m)), []);
  });

  test('the data-quality payload previews the exact count the bulk verify will apply', async () => {
    assert.equal((await get('/api/admin/data-quality')).body.unverified_count, expectedCount);
    assert.ok(expectedCount > 100, `expected the seeded prices to be counted, got ${expectedCount}`);
  });

  test('verifies exactly the in-scope prices and returns the count', async () => {
    const res = await post('/api/admin/bulk-verify', { confirm: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { count: expectedCount, verified_at: TODAY });
    const after_ = withDb((d) => d.prepare('SELECT * FROM beers ORDER BY id').all());
    const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
    const was = byId(before_);
    let changed = 0;
    for (const row of after_) {
      const b = was.get(row.id);
      const venueActive = withDb((d) => d.prepare('SELECT active FROM venues WHERE id = ?').get(row.venue_id).active);
      const inScope = b.verified_at == null && b.size_05 > 0 && b.active === 1 && venueActive === 1;
      if (inScope) { assert.equal(row.verified_at, TODAY, `beer ${row.id} should be verified`); changed++; }
      else assert.equal(row.verified_at, b.verified_at, `beer ${row.id} is out of scope and must keep verified_at`);
      // Whatever the scope: ONLY verified_at may differ.
      const { verified_at: _a, ...restNow } = row; const { verified_at: _b, ...restBefore } = b;
      assert.deepEqual(restNow, restBefore, `beer ${row.id}: nothing but verified_at may change`);
    }
    assert.equal(changed, expectedCount);
  });

  test('scope details: hidden venue, delisted beer, price-less beer stay unverified; an earlier verification date is kept', () => {
    withDb((d) => {
      const v = (id) => d.prepare('SELECT verified_at FROM beers WHERE id = ?').get(id).verified_at;
      assert.equal(v(real.delistedBeer), null);
      assert.equal(v(real.noPriceBeer), null);
      assert.equal(v(real.verifiedBeer), '2026-08-01');
      assert.equal(v(real.observedBeer), TODAY);
      assert.equal(d.prepare('SELECT price_observed_at FROM beers WHERE id = ?').get(real.observedBeer).price_observed_at, '2026-07-15');
      assert.equal(d.prepare('SELECT COUNT(*) AS n FROM beers WHERE venue_id = ? AND verified_at IS NOT NULL').get(real.hiddenVenue).n, 0);
      assert.equal(d.prepare('SELECT COUNT(*) AS n FROM price_history').get().n, 0, 'no price-history entry is created');
    });
  });

  test('writes one BULK_VERIFY audit entry with the count and the admin', async () => {
    const entries = await logs('BULK_VERIFY');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].performed_by, CREDS.username);
    assert.equal(entries[0].details.count, expectedCount);
    assert.equal(entries[0].details.verified_at, TODAY);
  });

  test('sends the Telegram notification', () => {
    assert.deepEqual(telegramMessages().filter((m) => /Bulk verify/.test(m)), [`✓ Bulk verify: ${expectedCount} prices verified — ${CREDS.username}`]);
  });

  test('the preview count is now 0, and the freshness the public site shows moved to FRESH', async () => {
    assert.equal((await get('/api/admin/data-quality')).body.unverified_count, 0);
    const beers = (await get('/api/venues', '')).body.flatMap((v) => v.beers);
    assert.ok(beers.some((b) => b.verified_at === TODAY && b.freshness_state === 'FRESH'));
  });

  test('running it again verifies nothing and leaves no second audit entry or message', async () => {
    const res = await post('/api/admin/bulk-verify', { confirm: true });
    assert.deepEqual(res.body, { count: 0, verified_at: TODAY });
    assert.equal((await logs('BULK_VERIFY')).length, 1);
    assert.equal(telegramMessages().filter((m) => /Bulk verify/.test(m)).length, 1);
  });
});
