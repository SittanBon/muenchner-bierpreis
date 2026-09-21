// The serve types live in frontend/src/constants/serveTypes.js (the UI's single source) and in
// backend/db/database.js (what the API accepts). This proves they agree, and that the backend
// turns anything else into 'unknown' instead of storing it.
//   node --test backend/serveTypesParity.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bierpreis-serve-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
const { SERVE_TYPES: backendTypes, normalizeServeType } = require('./db/database');

test('frontend and backend know the same serve types (backend adds "unknown")', async () => {
  const fe = await import(pathToFileURL(path.join(__dirname, '..', 'frontend', 'src', 'constants', 'serveTypes.js')).href);
  assert.deepEqual([...backendTypes].sort(), [...fe.SERVE_TYPES.map((s) => s.value), fe.UNKNOWN_SERVE_TYPE].sort());
  assert.deepEqual(fe.SERVE_TYPES.map((s) => [s.value, s.label_de, s.label_en, s.icon]), [
    ['tap', 'Vom Fass', 'On Tap', '🍺'], ['bottle', 'Flasche', 'Bottle', '🍾'], ['can', 'Dose', 'Can', '🥫'],
  ]);
});

test('the backend stores an unrecognised serve type as "unknown"', () => {
  for (const bad of ['keg', '', null, undefined, 'TAP', 42]) assert.equal(normalizeServeType(bad), 'unknown', String(bad));
  for (const good of ['tap', 'bottle', 'can']) assert.equal(normalizeServeType(good), good);
});

// No component may re-type a serve type: the icons and German/English labels come from the
// constant. (The constant file itself and the translations' "unknown" wording are exempt.)
test('no component hardcodes a serve-type emoji or label', () => {
  const dir = path.join(__dirname, '..', 'frontend', 'src');
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(jsx?|css)$/.test(f.name) && !/\.test\./.test(f.name)) files.push(p); } })(dir);
  const offenders = [];
  for (const f of files) {
    if (f.endsWith(path.join('constants', 'serveTypes.js')) || f.endsWith('translations.js')) continue;
    const src = fs.readFileSync(f, 'utf8');
    // the emoji are used ONLY as serve-type icons (🍺 also appears as decoration, so it is not scanned)
    for (const needle of ['🍾', '🥫', "'Vom Fass'", '"Vom Fass"', "'On Tap'", '"On Tap"']) {
      if (src.includes(needle)) offenders.push(`${path.relative(dir, f)}: ${needle}`);
    }
    if (/<option value="(tap|bottle|can)"/.test(src)) offenders.push(`${path.relative(dir, f)}: hardcoded serve <option>`);
  }
  assert.deepEqual(offenders, []);
});
