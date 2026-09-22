// Route-level tests: boots the REAL server (server.js) against a throwaway
// database and exercises the admin API over HTTP — authentication on every
// admin route, one-click verify, the price editor, price history, data-quality
// flags + dismissal, and the submission review flow (approve / reject).
//
// Telegram is explicitly blanked in the child's environment, so nothing here
// can ever reach a real bot even though the project's .env configures one.
//   node --test backend/adminApi.test.js
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bierpreis-api-'));
const CREDS = { username: 'tester', password: 'test-password-123' };
let base;
let server;
let token;
let output = '';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

const call = async (method, url, { body, auth = token } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
};
const get = (url, o) => call('GET', url, o);
const post = (url, body, o) => call('POST', url, { body, ...o });
const patch = (url, body, o) => call('PATCH', url, { body, ...o });

const adminVenue = async (id) => (await get('/api/admin/venues')).body.find((v) => v.id === id);

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: path.join(tmpDir, 'api.db'),
      NODE_ENV: 'development',
      ADMIN_USERNAME: CREDS.username,
      ADMIN_PASSWORD: CREDS.password,
      JWT_SECRET: 'test-jwt-secret',
      // Present-but-empty, so dotenv (which never overrides an existing variable)
      // can't fill in the real bot from .env.
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
    },
  });
  server.stdout.on('data', (d) => { output += d; });
  server.stderr.on('data', (d) => { output += d; });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/api/stats`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const login = await post('/api/admin/login', CREDS, { auth: '' });
  assert.equal(login.status, 200, `server failed to boot/login. Output:\n${output.slice(-1500)}`);
  token = login.body.token;
});

after(() => {
  server?.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('authentication — every admin route refuses an unauthenticated caller', () => {
  const routes = [
    ['GET', '/api/admin/venues'],
    ['GET', '/api/admin/submissions'],
    ['PATCH', '/api/admin/submissions/s001', { status: 'approved' }],
    ['GET', '/api/admin/data-quality'],
    ['POST', '/api/admin/bulk-verify', { confirm: true }],
    ['POST', '/api/admin/data-quality/dismiss', { flag: 'STALE_PRICE', venue_id: 'x' }],
    ['GET', '/api/admin/venues/x/beers/1/history'],
    ['POST', '/api/admin/venues/x/beers/1/verify', {}],
    ['POST', '/api/admin/venues/x/beers/1/confirm-size', {}],
    ['PATCH', '/api/admin/venues/x/beers/1', { size_05: 5 }],
    ['POST', '/api/admin/venues/x/beers', { brand: 'B', size_05: 5 }],
    ['DELETE', '/api/admin/venues/x/beers/1'],
    ['PATCH', '/api/admin/venues/x', { name: 'n' }],
    ['GET', '/api/admin/stats'],
    ['GET', '/api/admin/logs'],
  ];
  for (const [method, url, body] of routes) {
    test(`${method} ${url} -> 401 with no token, and with a forged one`, async () => {
      assert.equal((await call(method, url, { body, auth: '' })).status, 401);
      assert.equal((await call(method, url, { body, auth: 'not.a.token' })).status, 401);
    });
  }
  test('a token signed with the wrong secret is refused', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ username: 'tester' }, 'some-other-secret');
    assert.equal((await get('/api/admin/data-quality', { auth: forged })).status, 401);
  });
});

describe('public API never leaks admin-only price fields', () => {
  test('notes and source_type are absent from /api/venues and /api/venues/:id', async () => {
    const venues = (await get('/api/venues', { auth: '' })).body;
    const one = (await get(`/api/venues/${venues[0].id}`, { auth: '' })).body;
    for (const b of [...venues.flatMap((v) => v.beers), ...one.beers]) {
      assert.ok(!('notes' in b) && !('source_type' in b), 'admin-only fields must not be public');
    }
  });
});

describe('one-click verify (Task 3)', () => {
  test('sets verified_at only — price, observation date, technical `updated` and history untouched — and is logged', async () => {
    const v = (await get('/api/admin/venues')).body[0];
    const b = v.beers[0];
    const histBefore = (await get(`/api/admin/venues/${v.id}/beers/${b.id}/history`)).body.entries.length;

    const res = await post(`/api/admin/venues/${v.id}/beers/${b.id}/verify`, {});
    assert.equal(res.status, 200);
    const after = res.body.beers.find((x) => x.id === b.id);
    assert.equal(after.verified_at, new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date()));
    assert.deepEqual(
      [after.size_05, after.price_observed_at, after.updated, after.serving_volume_ml],
      [b.size_05, b.price_observed_at, b.updated, b.serving_volume_ml],
    );
    assert.equal((await get(`/api/admin/venues/${v.id}/beers/${b.id}/history`)).body.entries.length, histBefore, 'verify must not create a history entry');

    const logs = (await get('/api/admin/logs?action_type=VERIFY_PRICE')).body;
    const entry = (logs.logs || logs.rows || logs.items || logs).find?.((l) => l.venue_id === v.id);
    assert.ok(entry, 'VERIFY_PRICE must be in the audit log');
    assert.equal(entry.performed_by, CREDS.username, 'the log names the admin who verified');
  });

  test('a missing beer / venue is a 404', async () => {
    const v = (await get('/api/admin/venues')).body[0];
    assert.equal((await post(`/api/admin/venues/${v.id}/beers/999999/verify`, {})).status, 404);
    assert.equal((await post('/api/admin/venues/no-such-venue/beers/1/verify', {})).status, 404);
  });
});

describe('confirm size (Fix 3: serving size review helper)', () => {
  const dqFlagsFor = (dq, venueId) => dq.venues.find((g) => g.venue_id === venueId)?.flags || [];

  test('a freshly seeded beer is unconfirmed and flagged ASSUMED_HALF_LITRE', async () => {
    const v = (await get('/api/admin/venues')).body.find((x) => x.beers.some((b) => b.size_05 > 0));
    const b = v.beers.find((x) => x.size_05 > 0);
    assert.equal(b.size_confirmed, false);
    const dq = (await get('/api/admin/data-quality')).body;
    assert.ok(dqFlagsFor(dq, v.id).some((f) => f.flag === 'ASSUMED_HALF_LITRE' && f.beer_id === b.id));
  });

  test('sets size_confirmed only — price, dates, technical `updated` and history untouched — clears the flag, and is logged', async () => {
    const v = (await get('/api/admin/venues')).body.find((x) => x.beers.some((b) => b.size_05 > 0 && !b.size_confirmed));
    const b = v.beers.find((x) => x.size_05 > 0 && !x.size_confirmed);
    const histBefore = (await get(`/api/admin/venues/${v.id}/beers/${b.id}/history`)).body.entries.length;

    const res = await post(`/api/admin/venues/${v.id}/beers/${b.id}/confirm-size`, {});
    assert.equal(res.status, 200);
    const after = res.body.beers.find((x) => x.id === b.id);
    assert.equal(after.size_confirmed, true);
    assert.deepEqual(
      [after.size_05, after.price_observed_at, after.verified_at, after.updated, after.serving_volume_ml],
      [b.size_05, b.price_observed_at, b.verified_at, b.updated, b.serving_volume_ml],
    );
    assert.equal((await get(`/api/admin/venues/${v.id}/beers/${b.id}/history`)).body.entries.length, histBefore, 'confirm-size must not create a history entry');
    const dqAfter = (await get('/api/admin/data-quality')).body;
    assert.ok(!dqFlagsFor(dqAfter, v.id).some((f) => f.beer_id === b.id && f.flag === 'ASSUMED_HALF_LITRE'));

    const logs = (await get('/api/admin/logs?action_type=CONFIRM_SIZE')).body;
    const entry = (logs.logs || logs.rows || logs.items || logs).find?.((l) => l.venue_id === v.id);
    assert.ok(entry, 'CONFIRM_SIZE must be in the audit log');
    assert.equal(entry.performed_by, CREDS.username);
  });

  test('confirming an already-confirmed size is a no-op and is not logged again', async () => {
    const v = (await get('/api/admin/venues')).body.find((x) => x.beers.some((b) => b.size_confirmed));
    const b = v.beers.find((x) => x.size_confirmed);
    const countEntries = async () => {
      const logs = (await get('/api/admin/logs?action_type=CONFIRM_SIZE')).body;
      return (logs.logs || logs.rows || logs.items || logs).length;
    };
    const before = await countEntries();
    const res = await post(`/api/admin/venues/${v.id}/beers/${b.id}/confirm-size`, {});
    assert.equal(res.status, 200);
    assert.equal(res.body.beers.find((x) => x.id === b.id).size_confirmed, true);
    assert.equal(await countEntries(), before);
  });

  test('a beer with no serving size at all has nothing to confirm', async () => {
    const venue = (await get('/api/admin/venues')).body.find((v) => v.beers.length);
    const beer = venue.beers[0];
    await patch(`/api/admin/venues/${venue.id}/beers/${beer.id}`, { size_05: beer.size_05, size_mass: beer.size_mass, serving_volume_ml: null });
    assert.equal((await post(`/api/admin/venues/${venue.id}/beers/${beer.id}/confirm-size`, {})).status, 400);
  });

  test('a missing beer / venue is a 404', async () => {
    const v = (await get('/api/admin/venues')).body[0];
    assert.equal((await post(`/api/admin/venues/${v.id}/beers/999999/confirm-size`, {})).status, 404);
    assert.equal((await post('/api/admin/venues/no-such-venue/beers/1/confirm-size', {})).status, 404);
  });

  test('PATCHing serving_volume_ml (an admin edit of the size) confirms it too — Save, not just the dedicated button', async () => {
    const v = (await get('/api/admin/venues')).body.find((x) => x.beers.some((b) => b.size_05 > 0 && !b.size_confirmed));
    const b = v.beers.find((x) => x.size_05 > 0 && !x.size_confirmed);
    const res = await patch(`/api/admin/venues/${v.id}/beers/${b.id}`, { size_05: b.size_05, size_mass: b.size_mass, serving_volume_ml: b.serving_volume_ml });
    assert.equal(res.status, 200);
    assert.equal(res.body.beers.find((x) => x.id === b.id).size_confirmed, true);
  });
});

describe('price editor (Task 2) + history (Task 4)', () => {
  let venue; let beer;
  before(async () => {
    venue = (await get('/api/admin/venues')).body.find((v) => v.beers.length && v.beers[0].price_observed_at === null && v.beers[0].verified_at === null);
    beer = venue.beers[0];
  });
  const put = (over) => patch(`/api/admin/venues/${venue.id}/beers/${beer.id}`, { size_05: beer.size_05, size_mass: beer.size_mass, serve_type: beer.serve_type, ...over });

  test('rejects bad input server-side', async () => {
    assert.equal((await put({ price_observed_at: '2999-01-01' })).status, 400, 'future date');
    assert.equal((await put({ price_observed_at: '2026-02-30' })).status, 400, 'impossible date');
    assert.equal((await put({ source_type: 'PSYCHIC' })).status, 400, 'unknown source');
    assert.equal((await put({ notes: 'x'.repeat(501) })).status, 400, 'notes too long');
    assert.equal((await put({ notes: 42 })).status, 400, 'notes not a string');
    assert.equal((await put({ serving_volume_ml: 300 })).status, 400, 'unsupported size');
    assert.equal((await put({ size_05: 0 })).status, 400, 'zero price');
    assert.equal((await put({ size_05: 450 })).status, 400, 'absurd price');
  });

  test('a save that changes nothing changes nothing and creates no history', async () => {
    const before = await adminVenue(venue.id);
    const res = await put({});
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.beers.find((b) => b.id === beer.id), before.beers.find((b) => b.id === beer.id));
    assert.equal((await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries.length, 0);
  });

  test('notes, source and observed date save; verified_at is NOT set by saving; still no history', async () => {
    const res = await put({ notes: 'Checked the menu board', source_type: 'MENU_PHOTO', price_observed_at: '2026-09-01' });
    assert.equal(res.status, 200);
    const b = res.body.beers.find((x) => x.id === beer.id);
    assert.deepEqual([b.notes, b.source_type, b.price_observed_at, b.verified_at], ['Checked the menu board', 'MENU_PHOTO', '2026-09-01', null]);
    assert.equal((await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries.length, 0);
    // …and none of it is public
    const pub = (await get(`/api/venues/${venue.id}`, { auth: '' })).body;
    assert.ok(!JSON.stringify(pub).includes('Checked the menu board'));
  });

  test('a real price + serving-size change: saved, normalized price updates, ONE history entry, logged', async () => {
    const newPrice = Math.round((beer.size_05 + 0.3) * 100) / 100;
    const res = await put({ size_05: newPrice, serving_volume_ml: 330, price_observed_at: '2026-09-10', source_type: 'VENUE' });
    assert.equal(res.status, 200);
    const b = res.body.beers.find((x) => x.id === beer.id);
    assert.deepEqual([b.size_05, b.serving_volume_ml, b.price_observed_at, b.source_type, b.verified_at], [newPrice, 330, '2026-09-10', 'VENUE', null]);
    assert.equal(b.normalized_500ml_price, Math.round((newPrice / 330 * 500) * 100) / 100);

    const h = (await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body;
    assert.equal(h.entries.length, 1);
    assert.deepEqual(
      [h.entries[0].price, h.entries[0].serving_volume_ml, h.entries[0].date, h.entries[0].source_type, h.entries[0].submitted_by, h.entries[0].status, h.entries[0].kind, h.entries[0].is_current],
      [newPrice, 330, '2026-09-10', 'VENUE', CREDS.username, 'approved', 'observation', true],
    );
    assert.equal(h.entries[0].normalized_500ml_price, b.normalized_500ml_price);

    const logs = (await get('/api/admin/logs?action_type=EDIT_BEER')).body;
    const list = logs.logs || logs.rows || logs.items || logs;
    const entry = list.find((l) => l.venue_id === venue.id && l.details?.changed_fields?.includes('serving_volume_ml'));
    assert.ok(entry, 'the edit is in the audit log with its changed fields');
    assert.ok(!JSON.stringify(entry).includes('Checked the menu board'), 'notes content is not copied into the log');
  });

  test('history of a beer at another venue is a 404', async () => {
    const other = (await get('/api/admin/venues')).body.find((v) => v.id !== venue.id);
    assert.equal((await get(`/api/admin/venues/${other.id}/beers/${beer.id}/history`)).status, 404);
  });
});

describe('data quality (Task 1)', () => {
  test('summary, per-flag counts and grouped venues are consistent', async () => {
    const res = await get('/api/admin/data-quality');
    assert.equal(res.status, 200);
    const { summary, venues, thresholds } = res.body;
    assert.equal(summary.venues_needing_attention, venues.length);
    assert.equal(summary.total_flags, venues.reduce((n, v) => n + v.flags.length, 0));
    assert.deepEqual(thresholds, { MIN_PRICE: 0.5, MAX_PRICE: 20, MAX_NORMALIZED_PRICE: 15, DISMISS_DAYS: 7 });
    for (const code of ['MISSING_SERVING_SIZE', 'MISSING_PRICE', 'MISSING_OBSERVATION_DATE', 'STALE_PRICE', 'INVALID_PRICE',
      'VENUE_WITHOUT_ACTIVE_PRICE', 'DUPLICATE_VENUE', 'EXTREME_NORMALIZED_PRICE']) {
      assert.ok(code in summary.by_flag, code);
    }
    // freshly seeded prices carry no dates: honestly flagged, not hidden
    assert.ok(summary.by_flag.MISSING_OBSERVATION_DATE > 0);
  });

  test('the venue list carries each venue’s flags (for the badges and the flag search)', async () => {
    const venues = (await get('/api/admin/venues')).body;
    assert.ok(venues.every((v) => Array.isArray(v.flags)));
    assert.ok(venues.some((v) => v.flags.some((f) => f.flag === 'MISSING_OBSERVATION_DATE')));
  });

  test('Dismiss hides exactly one flag, fixes and deletes nothing, and is logged', async () => {
    const dq = (await get('/api/admin/data-quality')).body;
    const group = dq.venues.find((g) => g.flags.some((f) => f.flag === 'MISSING_OBSERVATION_DATE' && f.beer_id));
    const flag = group.flags.find((f) => f.flag === 'MISSING_OBSERVATION_DATE' && f.beer_id);
    const beforeVenue = await adminVenue(group.venue_id);

    const res = await post('/api/admin/data-quality/dismiss', { flag: flag.flag, venue_id: group.venue_id, beer_id: flag.beer_id });
    assert.equal(res.status, 200);
    assert.ok(Date.parse(res.body.dismissed_until) > Date.now() + 6.9 * 86400000);

    const dq2 = (await get('/api/admin/data-quality')).body;
    const g2 = dq2.venues.find((g) => g.venue_id === group.venue_id);
    assert.ok(!g2 || !g2.flags.some((f) => f.flag === flag.flag && f.beer_id === flag.beer_id));
    assert.equal(dq2.summary.dismissed_active >= 1, true);
    // the data itself is exactly as it was
    const afterVenue = await adminVenue(group.venue_id);
    assert.deepEqual(afterVenue.beers.map(({ id, size_05, verified_at, price_observed_at }) => ({ id, size_05, verified_at, price_observed_at })),
      beforeVenue.beers.map(({ id, size_05, verified_at, price_observed_at }) => ({ id, size_05, verified_at, price_observed_at })));

    const logs = (await get('/api/admin/logs?action_type=DISMISS_FLAG')).body;
    assert.ok((logs.logs || logs.rows || logs.items || logs).some((l) => l.venue_id === group.venue_id));
  });

  test('bad dismiss requests are refused', async () => {
    const v = (await get('/api/admin/venues')).body[0];
    assert.equal((await post('/api/admin/data-quality/dismiss', { flag: 'NOT_A_FLAG', venue_id: v.id })).status, 400);
    assert.equal((await post('/api/admin/data-quality/dismiss', { flag: 'STALE_PRICE', venue_id: 'no-such-venue' })).status, 404);
    assert.equal((await post('/api/admin/data-quality/dismiss', { flag: 'STALE_PRICE', venue_id: v.id, beer_id: 999999 })).status, 404);
  });

  test('Verify from the flag list clears the MISSING_OBSERVATION_DATE flag (verified_at counts)', async () => {
    const dq = (await get('/api/admin/data-quality')).body;
    const group = dq.venues.find((g) => g.flags.some((f) => f.flag === 'MISSING_OBSERVATION_DATE' && f.verifiable));
    const flag = group.flags.find((f) => f.flag === 'MISSING_OBSERVATION_DATE');
    assert.equal(flag.verifiable, true);
    await post(`/api/admin/venues/${group.venue_id}/beers/${flag.beer_id}/verify`, {});
    const g2 = (await get('/api/admin/data-quality')).body.venues.find((g) => g.venue_id === group.venue_id);
    assert.ok(!g2 || !g2.flags.some((f) => f.flag === 'MISSING_OBSERVATION_DATE' && f.beer_id === flag.beer_id));
  });
});

describe('submission review (Task 6)', () => {
  let venue; let beer;
  before(async () => {
    venue = (await get('/api/venues', { auth: '' })).body.find((v) => v.beers.length && v.beers[0].serving_volume_ml === 500);
    beer = venue.beers[0];
  });
  const submit = async (over) => {
    const res = await post('/api/submissions', {
      report_type: 'price_change', venue_id: venue.id, beer_brand: beer.brand, price: beer.size_05, size: '0.5L', serve_type: 'tap', ...over,
    }, { auth: '' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.id;
  };
  const queue = async () => (await get('/api/admin/submissions?status=pending')).body;

  test('the queue shows price + size, per-0.5 L price, the current price, the difference, visit date and source', async () => {
    const id = await submit({ price: 3.5, size: '0.33L', visit_date: '2026-09-10' });
    const s = (await queue()).find((x) => x.id === id);
    assert.equal(s.size, '0.33L');
    assert.equal(s.serving_volume_ml, 330);
    assert.equal(s.normalized_500ml_price, 5.3);
    assert.equal(s.visit_date, '2026-09-10');
    assert.equal(s.source_type, 'COMMUNITY');
    assert.equal(s.current.price, beer.size_05);
    assert.equal(typeof s.difference_pct, 'number');
  });

  test('flags a submission more than 25% away from the current price', async () => {
    const far = await submit({ price: Math.round(beer.size_05 * 1.4 * 100) / 100 });
    const near = await submit({ price: Math.round(beer.size_05 * 1.1 * 100) / 100 });
    const q = await queue();
    assert.equal(q.find((x) => x.id === far).outlier, true);
    assert.equal(q.find((x) => x.id === near).outlier, false);
  });

  test('REJECT changes no price data and no timestamp — but the rejected report stays visible in the history', async () => {
    const before = await adminVenue(venue.id);
    const id = await submit({ price: 9.9, size: '0.5L' });
    const res = await patch(`/api/admin/submissions/${id}`, { status: 'rejected', reject_reason: 'looks wrong' });
    assert.equal(res.status, 200);
    const after = await adminVenue(venue.id);
    assert.deepEqual(after.beers, before.beers, 'no beer field — price, dates, updated, reports — may change');
    const hist = (await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries;
    assert.ok(hist.some((e) => e.price === 9.9 && e.status === 'rejected'));
  });

  test('APPROVE: headline updated, observed = visit date, NOT verified, one history entry, source COMMUNITY', async () => {
    // give the beer a verification first so we can see approval refuse to keep it
    await post(`/api/admin/venues/${venue.id}/beers/${beer.id}/verify`, {});
    const newPrice = Math.round((beer.size_05 + 0.2) * 100) / 100;
    // Baseline BEFORE submitting: a pending report already shows in the history
    // (as "pending"); approving it turns that same row into the applied entry,
    // so the net effect of submit + approve is exactly one new row.
    const histBefore = (await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries.length;
    const id = await submit({ price: newPrice, size: '0.5L', visit_date: '2026-09-12', submitter_name: 'Anna' });
    const pendingRow = (await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries.find((e) => e.price === newPrice);
    assert.equal(pendingRow.status, 'pending');

    const res = await patch(`/api/admin/submissions/${id}`, { status: 'approved' });
    assert.equal(res.status, 200);
    assert.equal(res.body.price_applied, true);

    const b = (await adminVenue(venue.id)).beers.find((x) => x.id === beer.id);
    assert.deepEqual([b.size_05, b.price_observed_at, b.verified_at, b.source_type], [newPrice, '2026-09-12', null, 'COMMUNITY']);

    const h = (await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries;
    assert.equal(h.length, histBefore + 1, 'exactly one new history entry');
    const entry = h.find((e) => e.price === newPrice && e.status === 'approved');
    assert.deepEqual([entry.source_type, entry.submitted_by, entry.date], ['COMMUNITY', 'Anna', '2026-09-12']);
    assert.equal(h.filter((e) => e.price === newPrice).length, 1, 'the approval is not listed twice');

    // approving it again does nothing more
    await patch(`/api/admin/submissions/${id}`, { status: 'approved' });
    assert.equal((await get(`/api/admin/venues/${venue.id}/beers/${beer.id}/history`)).body.entries.length, histBefore + 1);
  });
});

describe('admin search inputs are present on the venue payload (Task 5)', () => {
  test('each admin venue carries address, neighbourhood names, brands, serving sizes and flags', async () => {
    const v = (await get('/api/admin/venues')).body[0];
    for (const k of ['name', 'address', 'neighbourhood_name_de', 'neighbourhood_name_en', 'beers', 'flags']) assert.ok(k in v, k);
    for (const b of v.beers) assert.ok('brand' in b && 'serving_volume_ml' in b);
  });
});

// ─── Serving size on every price-creating route ─────────────────────────────
// serving_volume_ml must be one of [250, 330, 400, 500, 1000]; anything else is
// a 400. Omitted keeps the historic meaning of those forms' price field (0.5 L).
describe('serving size is validated wherever a price is created', () => {
  let hood;
  let uniq = 0;
  before(async () => { hood = (await get('/api/venues', { auth: '' })).body[0].neighbourhood_id; });
  const newVenueBody = (beer) => ({ name: `Size Test Bar ${++uniq}`, type: 'bar', neighbourhood_id: hood, beers: [{ brand: 'Augustiner', size_05: 4.2, serve_type: 'tap', ...beer }] });
  const BAD = [0, 123, 300, -500, 500.5, 2000, 'abc', '', null, '0.5L', {}, []];

  test('PATCH price: every unsupported value is a 400 (and every supported one is accepted)', async () => {
    const v = (await get('/api/admin/venues')).body.find((x) => x.beers.length);
    const b = v.beers[0];
    for (const bad of BAD.filter((x) => x !== null)) {
      assert.equal((await patch(`/api/admin/venues/${v.id}/beers/${b.id}`, { size_05: b.size_05, serving_volume_ml: bad })).status, 400, `PATCH ${JSON.stringify(bad)}`);
    }
    for (const ok of [250, 330, 400, 500, 1000, '330']) {
      assert.equal((await patch(`/api/admin/venues/${v.id}/beers/${b.id}`, { size_05: b.size_05, serving_volume_ml: ok })).status, 200, `PATCH ${JSON.stringify(ok)}`);
    }
  });

  test('POST /api/admin/venues: the chosen size is stored, normalised and put in the history; bad sizes create nothing', async () => {
    const before = (await get('/api/admin/venues')).body.length;
    for (const bad of BAD) {
      assert.equal((await post('/api/admin/venues', newVenueBody({ serving_volume_ml: bad }))).status, 400, `create ${JSON.stringify(bad)}`);
    }
    assert.equal((await get('/api/admin/venues')).body.length, before, 'a rejected request must not create a venue');

    const res = await post('/api/admin/venues', newVenueBody({ serving_volume_ml: 330, size_05: 3.3 }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const beer = res.body.beers[0];
    assert.equal(beer.serving_volume_ml, 330);
    assert.equal(beer.normalized_500ml_price, 5);   // 3.30 / 330 × 500
    const hist = (await get(`/api/admin/venues/${res.body.id}/beers/${beer.id}/history`)).body.entries;
    assert.equal(hist.length, 1);
    assert.equal(hist[0].serving_volume_ml, 330);
  });

  test('POST /api/admin/venues: an omitted size keeps meaning 0.5 L (older clients)', async () => {
    const res = await post('/api/admin/venues', newVenueBody({}));
    assert.equal(res.status, 201);
    assert.equal(res.body.beers[0].serving_volume_ml, 500);
  });

  test('POST /api/admin/venues/:id/beers: size validated, stored and logged', async () => {
    const v = (await post('/api/admin/venues', newVenueBody({}))).body;
    for (const bad of BAD) {
      assert.equal((await post(`/api/admin/venues/${v.id}/beers`, { brand: 'Paulaner', size_05: 4.5, serving_volume_ml: bad })).status, 400, `add beer ${JSON.stringify(bad)}`);
    }
    assert.equal((await adminVenue(v.id)).beers.length, 1, 'a rejected request adds nothing');
    const ok = await post(`/api/admin/venues/${v.id}/beers`, { brand: 'Paulaner', size_05: 4.5, serving_volume_ml: 400 });
    assert.equal(ok.status, 201);
    const added = ok.body.beers.find((b) => b.brand === 'Paulaner');
    assert.equal(added.serving_volume_ml, 400);
    assert.equal(added.normalized_500ml_price, 5.63);
    const logs = (await get('/api/admin/logs?action_type=ADD_BEER')).body;
    const entry = (logs.logs || logs.rows || logs.items || logs).find((l) => l.venue_id === v.id && l.details.brand === 'Paulaner');
    assert.equal(entry.details.serving_volume_ml, 400);
    assert.equal(entry.details.size, '0.4L');
  });

  describe('POST /api/submissions/new-venue ("Missing a bar?")', () => {
    const proposal = (over) => ({
      name: `Missing Bar ${++uniq}`, type: 'bar', neighbourhood_id: hood, beer_brand: 'Augustiner', size_05: 4.5, serve_type: 'tap', ...over,
    });

    test('rejects an unsupported size — for the first beer and for extra beers', async () => {
      for (const bad of ['0.3L', '2L', '0.50L', '500', 'abc']) {
        assert.equal((await post('/api/submissions/new-venue', proposal({ size: bad }), { auth: '' })).status, 400, `size ${bad}`);
        const extra = JSON.stringify([{ brand: 'Paulaner', size_05: 5, size: bad }]);
        assert.equal((await post('/api/submissions/new-venue', proposal({ extra_beers: extra }), { auth: '' })).status, 400, `extra size ${bad}`);
      }
    });

    test('approving creates each beer at ITS chosen size (first beer and extras)', async () => {
      const extra = JSON.stringify([{ brand: 'Paulaner', size_05: 5, size: '1L' }, { brand: 'Hacker-Pschorr', size_05: 4, size: '0.25L' }]);
      const body = proposal({ size: '0.33L', size_05: 3.3, extra_beers: extra });
      const sent = await post('/api/submissions/new-venue', body, { auth: '' });
      assert.equal(sent.status, 201, JSON.stringify(sent.body));
      const approved = await patch(`/api/admin/submissions/${sent.body.id}`, { status: 'approved' });
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      const venue = (await get('/api/admin/venues')).body.find((v) => v.name === body.name);
      const size = (brand) => venue.beers.find((b) => b.brand === brand).serving_volume_ml;
      assert.deepEqual([size('Augustiner'), size('Paulaner'), size('Hacker-Pschorr')], [330, 1000, 250]);
    });

    test('an omitted size is still the 0.5 L the form has always meant', async () => {
      const body = proposal({ extra_beers: JSON.stringify([{ brand: 'Paulaner', size_05: 5 }]) });
      const sent = await post('/api/submissions/new-venue', body, { auth: '' });
      assert.equal(sent.status, 201);
      await patch(`/api/admin/submissions/${sent.body.id}`, { status: 'approved' });
      const venue = (await get('/api/admin/venues')).body.find((v) => v.name === body.name);
      assert.deepEqual(venue.beers.map((b) => b.serving_volume_ml), [500, 500]);
    });
  });
});

// ─── Shared frontend constants stay equal to what the backend serves ────────
describe('frontend constants agree with the backend', () => {
  test('the Price Trends brand list is the backend’s TREND_BRANDS, and every one is a known brand', async () => {
    const { pathToFileURL } = require('url');
    const brands = await import(pathToFileURL(path.join(ROOT, 'frontend', 'src', 'constants', 'brands.js')).href);
    const api = (await get('/api/stats/trends', { auth: '' })).body;
    assert.deepEqual(api.brandOrder, [...brands.TREND_BRANDS, 'others']);
    for (const b of brands.TREND_BRANDS) assert.ok(brands.BRANDS.includes(b), `${b} is in the brand list`);
  });
});

describe('venue types', () => {
  test('the frontend and backend lists are identical', async () => {
    const { pathToFileURL } = require('url');
    const fe = await import(pathToFileURL(path.join(ROOT, 'frontend', 'src', 'constants', 'venueTypes.js')).href);
    assert.deepEqual(fe.VENUE_TYPES, require('./utils/venueTypes').VENUE_TYPES);
  });

  test('an unknown type is a 400 on create-venue, on a "Missing a bar?" proposal and on edit — and creates nothing', async () => {
    const hood = (await get('/api/venues', { auth: '' })).body[0].neighbourhood_id;
    const venuesBefore = (await get('/api/admin/venues')).body.length;
    const pendingBefore = (await get('/api/admin/submissions?status=pending')).body.length;
    for (const bad of ['pub', 'Bar', '', 'beer garden', 42]) {
      const c = await post('/api/admin/venues', { name: 'Bad Type', type: bad, neighbourhood_id: hood, beers: [{ brand: 'Augustiner', size_05: 4.2 }] });
      assert.equal(c.status, 400, `create type ${JSON.stringify(bad)}`);
      const m = await post('/api/submissions/new-venue', { name: 'Bad Type', type: bad, neighbourhood_id: hood, beer_brand: 'Augustiner', size_05: 4.2 }, { auth: '' });
      assert.equal(m.status, 400, `proposal type ${JSON.stringify(bad)}`);
    }
    const v = (await get('/api/admin/venues')).body[0];
    assert.equal((await patch(`/api/admin/venues/${v.id}`, { name: v.name, type: 'pub' })).status, 400, 'edit');
    assert.equal((await get('/api/admin/venues')).body.length, venuesBefore);
    assert.equal((await get('/api/admin/submissions?status=pending')).body.length, pendingBefore);
  });
});

// ─── Report notes: length cap and "which field is wrong" ─────────────────────
describe('report notes (Phase 6)', () => {
  let venue;
  before(async () => { venue = (await get('/api/venues', { auth: '' })).body.find((v) => v.beers.length); });
  const send = (over) => post('/api/submissions', { report_type: 'other_info', venue_id: venue.id, note: 'Adresse stimmt nicht', ...over }, { auth: '' });
  const queueNote = async (id) => (await get('/api/admin/submissions?status=pending')).body.find((s) => s.id === id)?.note;

  test('a note of exactly 300 characters is accepted; 301 is a 400 — for every report type that carries one', async () => {
    assert.equal((await send({ note: 'x'.repeat(300) })).status, 201);
    for (const report_type of ['other_info', 'suggest_description']) {
      assert.equal((await send({ report_type, note: 'x'.repeat(301) })).status, 400, report_type);
    }
    const p = { report_type: 'price_change', beer_brand: venue.beers[0].brand, price: 4.5, size: '0.5L' };
    assert.equal((await send({ ...p, note: 'x'.repeat(301) })).status, 400, 'price_change');
    assert.equal((await send({ report_type: 'closed', note: 'y'.repeat(301) })).status, 400, 'closed');
  });

  test('a non-string note is refused (it used to throw on .trim())', async () => {
    for (const note of [42, {}, ['a']]) assert.equal((await send({ note })).status, 400, JSON.stringify(note));
  });

  test('"closed" needs no note at all (one-tap confirm)', async () => {
    assert.equal((await send({ report_type: 'closed', note: undefined })).status, 201);
  });

  test('wrong_field is validated and shown to the admin as a note prefix', async () => {
    const r = await send({ wrong_field: 'hours', note: 'Sonntags geschlossen' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(await queueNote(r.body.id), '[Falsches Feld: Öffnungszeiten] Sonntags geschlossen');
    for (const [k, label] of Object.entries({ name: 'Name', address: 'Adresse', brand: 'Biermarke', other: 'Andere' })) {
      const x = await send({ wrong_field: k, note: 'n' });
      assert.equal(await queueNote(x.body.id), `[Falsches Feld: ${label}] n`, k);
    }
  });

  test('an empty wrong_field is ignored; an unknown one, or one on another report type, is a 400', async () => {
    const ok = await send({ wrong_field: '', note: 'nur Text' });
    assert.equal(ok.status, 201);
    assert.equal(await queueNote(ok.body.id), 'nur Text');
    assert.equal((await send({ wrong_field: 'password' })).status, 400);
    assert.equal((await send({ wrong_field: '__proto__' })).status, 400);
    assert.equal((await send({ report_type: 'closed', wrong_field: 'name' })).status, 400);
  });

  test('the "Missing a bar?" note is capped at 300 too, and nothing is stored when refused', async () => {
    const hood = (await get('/api/venues', { auth: '' })).body[0].neighbourhood_id;
    const before = (await get('/api/admin/submissions?status=pending')).body.length;
    const body = { name: 'Zu lange Notiz', type: 'bar', neighbourhood_id: hood, beer_brand: 'Augustiner', size_05: 4.5, note: 'z'.repeat(301) };
    assert.equal((await post('/api/submissions/new-venue', body, { auth: '' })).status, 400);
    assert.equal((await get('/api/admin/submissions?status=pending')).body.length, before);
    assert.equal((await post('/api/submissions/new-venue', { ...body, note: 'z'.repeat(300) }, { auth: '' })).status, 201);
  });
});

// ─── The report form's limits are the API's limits ──────────────────────────
describe('report form limits agree with the API', () => {
  test('note length, price bounds and the wrong-field choices are exactly what the form uses', async () => {
    const { pathToFileURL } = require('url');
    const o = await import(pathToFileURL(path.join(ROOT, 'frontend', 'src', 'constants', 'reportOptions.js')).href);
    const venue = (await get('/api/venues', { auth: '' })).body.find((v) => v.beers.length);
    const brand = venue.beers[0].brand;
    const send = (over) => post('/api/submissions', { report_type: 'other_info', venue_id: venue.id, note: 'x', ...over }, { auth: '' });
    const price = (p) => post('/api/submissions', { report_type: 'price_change', venue_id: venue.id, beer_brand: brand, size: '0.5L', price: p }, { auth: '' });

    assert.equal((await send({ note: 'x'.repeat(o.NOTE_MAX) })).status, 201, 'exactly NOTE_MAX is accepted');
    assert.equal((await send({ note: 'x'.repeat(o.NOTE_MAX + 1) })).status, 400, 'one more is refused');
    for (const f of o.WRONG_FIELDS) assert.equal((await send({ wrong_field: f })).status, 201, `wrong_field ${f}`);
    assert.equal((await price(o.PRICE_MIN)).status, 201, 'PRICE_MIN accepted');
    assert.equal((await price(o.PRICE_MAX)).status, 201, 'PRICE_MAX accepted');
    assert.equal((await price(o.PRICE_MIN - 0.01)).status, 400, 'below PRICE_MIN refused');
    assert.equal((await price(o.PRICE_MAX + 0.01)).status, 400, 'above PRICE_MAX refused');
  });
});
