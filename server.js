require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const {
  initSchema,
  isEmpty,
  SERVE_TYPES,
  normalizeServeType,
  getVenues,
  getVenue,
  getVenueAdmin,
  getNeighbourhoods,
  getCities,
  createCity,
  updateCity,
  getStats,
  getTrends,
  createVenue,
  updateVenue,
  setVenueActive,
  deleteVenue,
  addBeerToVenue,
  updateBeerPrice,
  verifyBeerPrice,
  bulkVerifyPrices,
  countUnverifiedPrices,
  applyApprovedPrice,
  getPublicPriceHistory,
  getBeerHistory,
  dismissFlag,
  getDataQuality,
  getAdminSubmissions,
  deleteBeer,
  logAdminAction,
  getAdminLogs,
  getAdminLogsForExport,
  DB_PATH,
  statements: S,
} = require('./backend/db/database');
const {
  notifyNewPriceReport,
  notifyNewVenue,
  notifyClosure,
  notifyIncorrectInfo,
  notifyDescriptionSuggestion,
  notifyApproved,
  notifyPriceVerified,
  notifyBulkVerified,
  notifyStartup,
} = require('./backend/notifications');
const { FLAG_CODES, THRESHOLDS, summarizeFlags, groupFlagsByVenue } = require('./backend/dataQuality');
const { filterVenues } = require('./backend/filterVenues');
const { isValidVenueType } = require('./backend/utils/venueTypes');
const {
  isValidSize,
  isValidVolume,
  validateVisitDate,
  volumeFromSize,
  normalizePrice,
  todayISO,
  isValidSourceType,
  NOTES_MAX_LENGTH,
} = require('./backend/utils/priceUtils');

// Free text a visitor sends with a report (the note, or a proposed description) is capped —
// the forms stop at 300 characters and the API enforces the same limit.
const REPORT_NOTE_MAX = 300;
// "Andere falsche Info" can name WHICH field is wrong; the admin sees it as a note prefix.
const WRONG_FIELD_LABELS = { name: 'Name', address: 'Adresse', hours: 'Öffnungszeiten', brand: 'Biermarke', other: 'Andere' };

const UPLOADS_DIR = path.join(__dirname, 'backend', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'bierpreis-dev-secret-change-me';
const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'bierpreis2025',
};

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set — using an insecure development default. Set it in .env.');
}

// ─── Bootstrap DB ────────────────────────────────────────────────────────────
initSchema();
if (isEmpty()) {
  console.log('🍺 Empty database detected — seeding from backend/db/seedData.js …');
  require('./backend/db/seed');
}

// One-time production backfill (see the file for the full story): 18 venues
// added to local dev in an earlier session but never migrated to production.
// Deliberately NOT gated on a venue-count threshold — migrate.js checks each
// of its 18 venues by name before inserting, so calling it unconditionally
// on every boot is a safe, cheap no-op once they're all present, and (unlike
// a "< 170" check) it can never mistake a deliberate admin deletion for
// missing data and silently re-add something a human removed on purpose.
require('./backend/db/migrate').runMigration();

// One-time Ludwigsvorstadt-Isarvorstadt boundary fix (see the file for the
// full story, including which of the request's original ~29 candidate
// venues turned out not to check out): adds Lehel + Schwanthalerhöhe,
// reassigns a specific, hand-verified list of existing venues into the
// now-corrected boundary, and adds a small number of Nominatim-confirmed
// real venues. Same reasoning as migrate.js above — idempotent by
// id/name, safe to call unconditionally on every boot.
require('./backend/db/expandLudwigsvorstadt').runExpansion();

// Aligns the neighbourhood structure with Munich's real Stadtbezirke:
// merges "lehel" into "altstadt" (officially one district, Altstadt-Lehel)
// and splits "schwabing" into "schwabing_west"/"schwabing_freimann"
// (officially two separate districts). Runs BEFORE reassignVenues below —
// that step's point-in-polygon pass targets the new schwabing_west/
// schwabing_freimann features, so those neighbourhood rows (inserted here)
// must already exist or its UPDATE would violate the neighbourhood_id
// foreign key. Idempotent (DB-only, no network calls), safe on every boot.
require('./backend/db/restructureNeighbourhoods').run();

// Reassigns every venue's neighbourhood_id against the REAL OpenStreetMap
// administrative boundaries in frontend/src/data/neighbourhoodGeoJSON.js
// (superseding the two hand-drawn polygon attempts above) — idempotent
// (each boot just re-tests every venue; already-correct ones are a no-op),
// safe to call unconditionally. See the file for the full reasoning,
// including the one verified surprise (Chinesischer Turm is officially in
// Lehel, not Schwabing) and the session report for the complete venue list.
require('./backend/db/reassignVenues').runReassignment();

// One-time removal of the fabricated "seeded price-trend history" submissions
// that early seeds wrote into the database (they fed the public Price Trends
// chart with invented prices). Idempotent — a no-op once none are left — and it
// takes its own backup first when it has something to delete. See
// removeSeededSubmissions in backend/db/database.js.
require('./backend/db/removeSeededSubmissions').run();

const app = express();
app.set('etag', false); // API responses are always regenerated from the live DB
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// Never let a browser or proxy serve a stale API response.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN.username && password === ADMIN.password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── NEIGHBOURHOODS ──────────────────────────────────────────────────────────
app.get('/api/neighbourhoods', (req, res) => {
  res.json(getNeighbourhoods());
});

// ─── CITIES ──────────────────────────────────────────────────────────────────
// Public — powers the navbar city selector. Munich (id=1) is the only active
// city today; the rest come back as coming_soon:true, venue_count:0.
app.get('/api/cities', (req, res) => {
  res.json(getCities());
});

// ─── STATS (public — powers the stats bar) ───────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

// ─── TRENDS (public — powers the Price Trends chart) ─────────────────────────
app.get('/api/stats/trends', (req, res) => {
  res.json(getTrends());
});

// ─── VENUES ──────────────────────────────────────────────────────────────────

app.get('/api/venues', (req, res) => {
  res.json(filterVenues(getVenues(), req.query));
});

app.get('/api/venues/:id', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Not found' });

  // Allow-listed columns only (see getPublicPriceHistory) — the raw
  // submission rows carry submitter names, notes and admin reject reasons.
  res.json({ ...venue, price_history: getPublicPriceHistory(req.params.id) });
});

// ─── SUBMISSIONS ─────────────────────────────────────────────────────────────

// Every field the new_venue-only columns need, defaulted to null so a single
// INSERT statement (with @named params) works for every report_type.
const BLANK_NEW_VENUE_FIELDS = {
  venue_type: null, neighbourhood_id: null, address: null, lat: null, lng: null,
  size_mass: null, photo_path: null, extra_beers: null,
};

function nextSubmissionId() {
  const seq = S.nextSubmissionSeq.get().n + 1;
  return `s${String(seq).padStart(3, '0')}`;
}

// The unified "📢 Report" button on a venue detail page funnels all four topics
// through here: price_change, new_beer (both need a brand+size+price), closed
// and other_info (neither does — a venue_id and/or a note is enough).
app.post('/api/submissions', (req, res) => {
  const {
    report_type = 'price_change',
    venue_id,
    venue_name,
    is_new_venue,
    beer_brand,
    size,
    price,
    serve_type,
    visit_date,
    submitter_name,
    note,
    wrong_field,
  } = req.body || {};

  const VALID_TYPES = ['price_change', 'new_beer', 'closed', 'other_info', 'suggest_description'];
  if (!VALID_TYPES.includes(report_type)) {
    return res.status(400).json({ error: 'Invalid report_type' });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'Invalid note' });
  }
  if (typeof note === 'string' && note.length > REPORT_NOTE_MAX) {
    return res.status(400).json({ error: `Note is too long (max ${REPORT_NOTE_MAX} characters)` });
  }
  // Which field is wrong — only meaningful for "other incorrect info". Validated against the
  // known list and folded into the note so the admin queue needs no new column.
  let composedNote = note || '';
  if (wrong_field !== undefined && wrong_field !== null && wrong_field !== '') {
    if (report_type !== 'other_info' || !Object.prototype.hasOwnProperty.call(WRONG_FIELD_LABELS, wrong_field)) {
      return res.status(400).json({ error: 'Invalid wrong_field' });
    }
    composedNote = `[Falsches Feld: ${WRONG_FIELD_LABELS[wrong_field]}] ${composedNote}`.trim();
  }

  let numPrice = null;
  if (report_type === 'price_change' || report_type === 'new_beer') {
    if (!price || !beer_brand || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    numPrice = parseFloat(price);
    if (Number.isNaN(numPrice) || numPrice < 1 || numPrice > 30) {
      return res.status(400).json({ error: 'Invalid price' });
    }
    // The serving size is what makes a price meaningful — an unrecognised
    // size string is rejected here (it used to be stored as-is, and later
    // treated as if it were a 0.5 L price on approval).
    if (!isValidSize(size)) {
      return res.status(400).json({ error: 'Invalid size' });
    }
  }
  // visit_date becomes the price's observation date when an admin approves
  // this, so it must be a real calendar date that isn't in the future.
  let resolvedVisitDate = todayISO();
  if (visit_date !== undefined && visit_date !== null && visit_date !== '') {
    const checked = validateVisitDate(visit_date);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    resolvedVisitDate = checked.value;
  }
  if (!venue_id) {
    return res.status(400).json({ error: 'venue_id is required' });
  }
  if ((report_type === 'other_info' || report_type === 'suggest_description') && !note?.trim()) {
    return res.status(400).json({ error: 'A note is required for this report type' });
  }

  // Outlier check: >25% deviation from that SPECIFIC BRAND's current price (only
  // meaningful when this report actually carries a price). Also resolves whether
  // `venue_id` names a real venue — `submissions.venue_id` has a FOREIGN KEY
  // REFERENCES venues(id), so a stale/unknown id must never reach the INSERT
  // below or SQLite throws and the request 500s with a raw stack trace.
  let isOutlier = false;
  const venue = getVenue(venue_id);
  if (!venue) {
    return res.status(400).json({ error: 'Unknown venue_id' });
  }
  const resolvedName = venue_name || venue.name;
  if (numPrice != null) {
    // Compared per 0.5 L, so a 0.33 L price is judged against the beer's
    // normalised price rather than its raw number. No known serving size on
    // the existing price -> nothing comparable -> not flagged.
    const beer = venue.beers.find((b) => b.brand === beer_brand);
    const submitted = normalizePrice(numPrice, volumeFromSize(size));
    const current = beer?.normalized_500ml_price;
    if (submitted != null && current && Math.abs(submitted - current) / current > 0.25) {
      isOutlier = true;
    }
  }

  const submission = {
    id: nextSubmissionId(),
    report_type,
    venue_id,
    venue_name: resolvedName || null,
    is_new_venue: is_new_venue ? 1 : 0,
    beer_brand: beer_brand || null,
    size: size || null,
    price: numPrice,
    // Only price_change/new_beer ever carry one — 'unknown' is a real answer
    // ("Don't know"), so it's only ever null when the report type has no
    // serve-type question at all (closed/other_info).
    serve_type: (report_type === 'price_change' || report_type === 'new_beer')
      ? normalizeServeType(serve_type) : null,
    visit_date: resolvedVisitDate,
    submitter_name: submitter_name || 'Anonym',
    note: composedNote,
    status: 'pending',
    is_outlier: isOutlier ? 1 : 0,
    created_at: new Date().toISOString(),
    ...BLANK_NEW_VENUE_FIELDS,
  };

  try {
    S.insertSubmission.run(submission);
  } catch (err) {
    console.error('Failed to insert submission:', err);
    return res.status(500).json({ error: 'Could not save submission' });
  }

  // Fire-and-forget — sendTelegramMessage already swallows its own errors, so
  // this can never delay or fail the response.
  const neighbourhoodName = venue.neighbourhood_name_de;
  if (report_type === 'price_change' || report_type === 'new_beer') {
    notifyNewPriceReport({
      venueName: resolvedName,
      neighbourhoodName,
      price: numPrice,
      size: submission.size,
      brand: beer_brand,
      submitterName: submission.submitter_name,
      visitDate: submission.visit_date,
      isOutlier,
    });
  } else if (report_type === 'closed') {
    notifyClosure({
      venueName: resolvedName,
      neighbourhoodName,
      submitterName: submission.submitter_name,
      visitDate: submission.visit_date,
    });
  } else if (report_type === 'other_info') {
    notifyIncorrectInfo({
      venueName: resolvedName,
      note: submission.note,
      submitterName: submission.submitter_name,
    });
  } else if (report_type === 'suggest_description') {
    notifyDescriptionSuggestion({
      venueName: resolvedName,
      note: submission.note,
      submitterName: submission.submitter_name,
    });
  }

  res.status(201).json({ message: 'Submitted successfully', id: submission.id, is_outlier: isOutlier });
});

// The "🍺 Missing a bar?" flow — a full new-venue proposal, with an optional
// photo, so this is multipart/form-data rather than JSON.
// Up to 5 beers total per new-venue submission — beer #1 lives in the
// submission's own beer_brand/size_05/size_mass/serve_type columns (unchanged
// from before multi-beer existed); beers #2-5 travel as this JSON array.
const MAX_EXTRA_BEERS = 4;

// Validates+normalises the raw `extra_beers` form field (a JSON string) into
// a clean array, or throws with a message safe to show the submitter.
function parseExtraBeers(raw) {
  if (!raw) return [];
  let arr;
  try { arr = JSON.parse(raw); } catch { throw new Error('Invalid extra_beers'); }
  if (!Array.isArray(arr)) throw new Error('Invalid extra_beers');
  if (arr.length > MAX_EXTRA_BEERS) throw new Error(`Maximum ${MAX_EXTRA_BEERS + 1} beers per submission`);
  return arr.map((b) => {
    const price = parseFloat(b.size_05);
    if (!b.brand || Number.isNaN(price) || price < 1 || price > 30) {
      throw new Error('Each additional beer needs a brand and a valid price');
    }
    const mass = b.size_mass != null && b.size_mass !== '' ? parseFloat(b.size_mass) : null;
    const size = b.size === undefined || b.size === '' ? '0.5L' : b.size;
    if (!isValidSize(size)) throw new Error('Invalid size for an additional beer');
    return {
      brand: String(b.brand),
      size,
      size_05: price,
      size_mass: mass != null && !Number.isNaN(mass) ? mass : null,
      serve_type: normalizeServeType(b.serve_type),
    };
  });
}

app.post('/api/submissions/new-venue', upload.single('photo'), (req, res) => {
  const {
    name, type, neighbourhood_id, address, lat, lng,
    beer_brand, size_05, size_mass, serve_type, extra_beers,
    visit_date, submitter_name, note, size,
  } = req.body || {};

  if (!name || !type || !neighbourhood_id || !beer_brand || !size_05) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'name, type, neighbourhood_id, beer_brand and size_05 are required' });
  }
  if (!isValidVenueType(type)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid type' });
  }
  const validHoods = getNeighbourhoods().map((n) => n.id);
  if (!validHoods.includes(neighbourhood_id)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Unknown neighbourhood_id' });
  }
  const numPrice = parseFloat(size_05);
  if (Number.isNaN(numPrice) || numPrice < 1 || numPrice > 30) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid price' });
  }
  // The first beer's serving size. Omitted = the 0.5 L the price field has
  // always meant; anything else must be a supported size.
  const newVenueSize = size === undefined || size === '' ? '0.5L' : size;
  if (!isValidSize(newVenueSize)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid size' });
  }
  if (typeof note === 'string' && note.length > REPORT_NOTE_MAX) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: `Note is too long (max ${REPORT_NOTE_MAX} characters)` });
  }
  let newVenueVisitDate = todayISO();
  if (visit_date !== undefined && visit_date !== null && visit_date !== '') {
    const checked = validateVisitDate(visit_date);
    if (!checked.ok) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: checked.error });
    }
    newVenueVisitDate = checked.value;
  }
  let parsedExtraBeers;
  try {
    parsedExtraBeers = parseExtraBeers(extra_beers);
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: err.message });
  }

  const submission = {
    id: nextSubmissionId(),
    report_type: 'new_venue',
    venue_id: null,
    venue_name: name,
    is_new_venue: 1,
    beer_brand,
    size: newVenueSize,
    price: numPrice,
    serve_type: normalizeServeType(serve_type),
    extra_beers: parsedExtraBeers.length ? JSON.stringify(parsedExtraBeers) : null,
    visit_date: newVenueVisitDate,
    submitter_name: submitter_name || 'Anonym',
    note: note || '',
    status: 'pending',
    is_outlier: 0,
    created_at: new Date().toISOString(),
    venue_type: type,
    neighbourhood_id,
    address: address || null,
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    size_mass: size_mass ? parseFloat(size_mass) : null,
    photo_path: req.file ? `/uploads/${req.file.filename}` : null,
  };

  try {
    S.insertSubmission.run(submission);
  } catch (err) {
    console.error('Failed to insert new-venue submission:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Could not save submission' });
  }

  const nHood = getNeighbourhoods().find((n) => n.id === neighbourhood_id);
  notifyNewVenue({
    name,
    address: submission.address,
    neighbourhoodName: nHood?.name_de || neighbourhood_id,
    price: numPrice,
    submitterName: submission.submitter_name,
  });

  res.status(201).json({ message: 'Submitted successfully', id: submission.id });
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

// Every admin response that returns a venue also carries its open data-quality
// flags, so the venue list's badges and the flag search stay correct after any
// edit without a full reload. (Flags are computed over ALL venues — duplicate
// detection needs the whole set — and honour active dismissals.)
function attachFlags(venue) {
  if (!venue) return venue;
  const { flags } = getDataQuality();
  return {
    ...venue,
    flags: flags.filter((f) => f.venue_id === venue.id).map((f) => ({ flag: f.flag, beer_id: f.beer_id, brand: f.brand })),
  };
}

// serving_volume_ml for a NEW price (admin create-venue / add-beer). Omitted
// keeps the long-standing meaning of those price fields — the 0.5 L price — so
// older clients and scripts still work; anything that IS supplied must be one of
// the supported sizes [250, 330, 400, 500, 1000] or the request is rejected.
const wireSizeFor = (ml) => ['0.25L', '0.33L', '0.4L', '0.5L', '1L'].find((sz) => volumeFromSize(sz) === ml) || null;
function parseNewServingVolume(raw) {
  if (raw === undefined) return { ok: true, value: 500 };
  const value = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
  return isValidVolume(value) ? { ok: true, value } : { ok: false };
}

// Server-side sanity bound for an admin-entered price (the public submission
// route already enforces 1–30). Rejects zero, negatives, NaN and typos like
// 450 — never trust that the admin UI validated it.
function isSanePrice(n) {
  return Number.isFinite(n) && n > 0 && n <= 100;
}
app.get('/api/admin/submissions', authMiddleware, (req, res) => {
  const { status } = req.query;
  // Each row also carries what a reviewer needs to judge it in place: the
  // submitted price at its serving size and per 0.5 L, the venue's current
  // price for that beer, the difference, and a live outlier flag.
  res.json(getAdminSubmissions(status));
});

app.patch('/api/admin/submissions/:id', authMiddleware, (req, res) => {
  const sub = S.submissionById.get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const { status, reject_reason } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  S.setSubmissionStatus.run({ id: sub.id, status, reject_reason: status === 'rejected' ? (reject_reason || null) : null });

  let createdVenueId = null;
  // null = this submission has no price to apply (closed/other_info/...);
  // otherwise whether the price actually reached the beers table.
  let priceApplied = null;
  let priceSkippedReason = null;
  // Side effects run only on a real transition INTO approved. Re-sending
  // "approved" for an already-approved submission used to re-apply the price
  // and bump the report counter a second time.
  if (status === 'approved' && sub.status !== 'approved') {
    // Captured for the APPROVE log entry below — null for a brand-new venue
    // (nothing to compare against) or for closed/other_info (no price at all).
    let oldPrice = null;
    let approvalExtra = {};

    // Provenance for every price this approval creates: community-sourced,
    // dated by the visit, attributed to the submitter, one history entry each.
    const communitySource = {
      source_type: 'COMMUNITY',
      record_history_by: sub.submitter_name || 'Anonym',
      history_submission_id: sub.id,
      history_event: 'approved_submission',
    };

    if (sub.report_type === 'new_venue') {
      // Build the venue from the captured proposal and materialise it — it then
      // shows up on the map/lists on the next fetch, no other wiring needed.
      // Beer #1 goes in with the venue itself; beers #2-5 (extra_beers) are
      // added right after in the same transaction-adjacent calls.
      createdVenueId = createVenue(
        {
          name: sub.venue_name,
          type: sub.venue_type,
          neighbourhood_id: sub.neighbourhood_id,
          address: sub.address,
          lat: sub.lat,
          lng: sub.lng,
          // The submitter's optional "Tell us about this place" note (never
          // auto-generated — a human wrote it, and an admin is approving it
          // right now, which is the review step) becomes the description.
          // German by default since that's what Munich submitters mostly write
          // in; the EN field is left for an admin to translate later.
          description_de: sub.note || null,
        },
        // A new-venue proposal's prices are 0.5 L prices seen on the
        // submitter's visit — that visit date is the observation date.
        [{
          brand: sub.beer_brand, size_05: sub.price, size_mass: sub.size_mass, serve_type: sub.serve_type,
          serving_volume_ml: volumeFromSize(sub.size) ?? 500, price_observed_at: sub.visit_date, ...communitySource,
        }],
      );
      if (sub.extra_beers) {
        let extraBeers = [];
        try { extraBeers = JSON.parse(sub.extra_beers); } catch { /* ignore malformed */ }
        for (const b of extraBeers) {
          // Older pending proposals have no per-beer size: those were 0.5 L prices.
          addBeerToVenue(createdVenueId, { ...b, serving_volume_ml: volumeFromSize(b.size) ?? 500, price_observed_at: sub.visit_date, ...communitySource });
        }
      }
      S.setSubmissionVenueId.run(createdVenueId, sub.id);
    } else if (sub.venue_id && sub.beer_brand && sub.price != null) {
      // price_change or new_beer: roll the price into that specific brand's row
      // if the venue already lists it, otherwise add it as a new beer — either
      // way this must never touch the wrong brand (a venue can list several).
      // applyApprovedPrice enforces the serving-size rules (see database.js):
      // an unrecognised size writes nothing at all — no price, no `updated`,
      // no `reports` bump — and is reported back so the admin isn't left
      // thinking the public price changed.
      const outcome = applyApprovedPrice(sub);
      priceApplied = outcome.applied;
      if (outcome.applied) {
        oldPrice = outcome.old
          ? (outcome.target === 'mass' ? outcome.old.size_mass : outcome.old.size_05)
          : null;
        approvalExtra = {
          size: sub.size,
          target: outcome.target,
          created_beer: outcome.created,
          ...(outcome.old && outcome.old.serving_volume_ml !== volumeFromSize(sub.size)
            ? { old_serving_volume_ml: outcome.old.serving_volume_ml } : {}),
        };
      } else {
        priceSkippedReason = outcome.reason;
        approvalExtra = { size: sub.size, price_applied: false, reason: outcome.reason };
      }
    } else if (sub.report_type === 'closed' && sub.venue_id) {
      // No dedicated "closed" UI action exists — approving the report itself
      // is the trigger: hide the venue from the public map and log it as its
      // own action_type (distinct from a manual TOGGLE_ACTIVE) so the audit
      // trail shows WHY it went inactive.
      setVenueActive(sub.venue_id, false);
      logAdminAction('MARK_CLOSED', {
        venueId: sub.venue_id,
        venueName: sub.venue_name,
        details: { venue_name: sub.venue_name },
      });
    } else if (sub.report_type === 'suggest_description' && sub.venue_id && sub.note) {
      // Approving IS the human-review step — a submitted description is never
      // shown until an admin explicitly approves this exact submission.
      // German field by default, same reasoning as the new-venue "about this
      // place" note; the admin can add/adjust the EN field afterwards.
      const venueBefore = getVenueAdmin(sub.venue_id);
      const oldDescription = venueBefore?.description_de ?? null;
      S.setVenueDescriptionDe.run({ venue_id: sub.venue_id, description_de: sub.note });
      logAdminAction('EDIT_VENUE', {
        venueId: sub.venue_id,
        venueName: sub.venue_name,
        details: { field: 'description_de', old_value: oldDescription, new_value: sub.note },
      });
    }
    // 'other_info' reports carry no automated DB action — the admin reads the
    // note and acts on it manually (e.g. via Manage Venues).

    logAdminAction('APPROVE', {
      venueId: createdVenueId || sub.venue_id,
      venueName: sub.venue_name,
      details: { submission_id: sub.id, old_price: oldPrice, new_price: sub.price, brand: sub.beer_brand, ...approvalExtra },
    });
    // Every approved submission gets a Telegram confirmation, not just the
    // price-bearing ones — previously a "closed" or "suggest_description"
    // approval sent nothing at all.
    notifyApproved({ venueName: sub.venue_name, price: sub.price, reportType: sub.report_type });
  } else if (status === 'rejected') {
    logAdminAction('REJECT', {
      venueId: sub.venue_id,
      venueName: sub.venue_name,
      details: { submission_id: sub.id, reason: reject_reason || null },
    });
  }

  const updated = S.submissionById.get(sub.id);
  res.json({
    message: 'Updated',
    submission: updated,
    venue_id: createdVenueId,
    price_applied: priceApplied,
    price_skipped_reason: priceSkippedReason,
  });
});

// ─── ADMIN VENUE MANAGEMENT ──────────────────────────────────────────────────

// Create a venue with one or more beers at once ("+ Add another beer" in the UI).
app.post('/api/admin/venues', authMiddleware, (req, res) => {
  const {
    name, type, neighbourhood_id, address, lat, lng,
    opening_hours, website, description_de, description_en, beers,
  } = req.body || {};

  if (!name || !type || !neighbourhood_id) {
    return res.status(400).json({ error: 'name, type and neighbourhood_id are required' });
  }
  if (!isValidVenueType(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!Array.isArray(beers) || beers.length === 0) {
    return res.status(400).json({ error: 'At least one beer is required' });
  }
  for (const b of beers) {
    if (!b.brand || b.size_05 == null || !isSanePrice(parseFloat(b.size_05))) {
      return res.status(400).json({ error: 'Each beer needs a brand and a valid 0.5L price' });
    }
    if (b.size_mass && !isSanePrice(parseFloat(b.size_mass))) {
      return res.status(400).json({ error: 'Invalid 1L price' });
    }
    if (!parseNewServingVolume(b.serving_volume_ml).ok) {
      return res.status(400).json({ error: 'Invalid serving_volume_ml' });
    }
  }
  const validHoods = getNeighbourhoods().map((n) => n.id);
  if (!validHoods.includes(neighbourhood_id)) {
    return res.status(400).json({ error: 'Unknown neighbourhood_id' });
  }

  try {
    const id = createVenue(
      { name, type, neighbourhood_id, address, lat, lng, opening_hours, website, description_de, description_en },
      beers.map((b) => ({
        brand: b.brand,
        size_05: parseFloat(b.size_05),
        size_mass: b.size_mass ? parseFloat(b.size_mass) : null,
        serve_type: b.serve_type,
        serving_volume_ml: parseNewServingVolume(b.serving_volume_ml).value,
        // An admin entering a price is recording it as current right now,
        // from the admin; that creation is the price's first history entry.
        price_observed_at: todayISO(),
        source_type: 'ADMIN',
        record_history_by: req.user?.username || 'admin',
      })),
    );
    const nHood = getNeighbourhoods().find((n) => n.id === neighbourhood_id);
    logAdminAction('ADD_VENUE', {
      venueId: id,
      venueName: name,
      details: { name, neighbourhood: nHood?.name_de || neighbourhood_id, type },
    });
    res.status(201).json(attachFlags(getVenueAdmin(id)));
  } catch (err) {
    console.error('Failed to create venue:', err);
    res.status(500).json({ error: 'Could not create venue' });
  }
});

// Manage Venues table — every venue including inactive ones (the public GET
// /api/venues hides those, but an admin still needs to see & re-activate them).
app.get('/api/admin/venues', authMiddleware, (req, res) => {
  const { venues, flags } = getDataQuality();
  const byVenue = {};
  for (const f of flags) (byVenue[f.venue_id] ||= []).push({ flag: f.flag, beer_id: f.beer_id, brand: f.brand });
  res.json(venues.map((v) => ({ ...v, flags: byVenue[v.id] || [] })));
});

// Full edit — every field the Manage Venues "Edit" form exposes (name, type,
// neighbourhood, address, coordinates, hours, website, both descriptions, and
// the active/inactive toggle). Beer prices/brands are handled by the routes
// below, not this one.
app.patch('/api/admin/venues/:id', authMiddleware, (req, res) => {
  const venue = getVenueAdmin(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const {
    name, type, neighbourhood_id, address, lat, lng,
    opening_hours, website, description_de, description_en, active,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!isValidVenueType(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  const validHoods = getNeighbourhoods().map((n) => n.id);
  if (!validHoods.includes(neighbourhood_id)) {
    return res.status(400).json({ error: 'Unknown neighbourhood_id' });
  }
  const numLat = lat === '' || lat == null ? null : parseFloat(lat);
  const numLng = lng === '' || lng == null ? null : parseFloat(lng);
  if ((numLat != null && Number.isNaN(numLat)) || (numLng != null && Number.isNaN(numLng))) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const nextActive = active !== false && active !== 0; // default to active unless explicitly turned off
  const ok = updateVenue(req.params.id, {
    name: name.trim(),
    type,
    neighbourhood_id,
    address, lat: numLat, lng: numLng,
    opening_hours, website, description_de, description_en,
    active: nextActive,
  });
  if (!ok) return res.status(404).json({ error: 'Venue not found' });

  // Diff against the pre-edit snapshot fetched at the top of this handler —
  // `active` gets its own action_type (TOGGLE_ACTIVE) distinct from the rest
  // of the form (EDIT_VENUE), one log row per changed field so each reads as
  // a clean "field: old → new" line in the Activity Log.
  // '' and null both mean "empty" for these optional text fields — the edit
  // form's inputs default an unset DB value to '', so comparing raw values
  // would log a spurious "field: null -> ''" no-op on every single save.
  const blankToNull = (v) => (v === '' || v === undefined ? null : v);
  const FIELD_DIFFS = [
    ['name', venue.name, name.trim()],
    ['type', venue.type, type],
    ['neighbourhood_id', venue.neighbourhood_id, neighbourhood_id],
    ['address', venue.address, blankToNull(address)],
    ['lat', venue.lat, numLat],
    ['lng', venue.lng, numLng],
    ['opening_hours', venue.opening_hours, blankToNull(opening_hours)],
    ['website', venue.website, blankToNull(website)],
    ['description_de', venue.description_de, blankToNull(description_de)],
    ['description_en', venue.description_en, blankToNull(description_en)],
  ];
  for (const [field, old_value, new_value] of FIELD_DIFFS) {
    if (old_value !== new_value) {
      logAdminAction('EDIT_VENUE', { venueId: venue.id, venueName: name.trim(), details: { field, old_value, new_value } });
    }
  }
  if (venue.active !== nextActive) {
    logAdminAction('TOGGLE_ACTIVE', {
      venueId: venue.id,
      venueName: name.trim(),
      details: { old_state: venue.active, new_state: nextActive },
    });
  }

  res.json(attachFlags(getVenueAdmin(req.params.id)));
});

// Hard delete — the venue and its beers are gone for good (beers cascade via
// their FK). Any historic submissions that pointed at it are detached
// (venue_id -> NULL) rather than deleted, so approved price history survives.
app.delete('/api/admin/venues/:id', authMiddleware, (req, res) => {
  const deleted = deleteVenue(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Venue not found' });
  logAdminAction('DELETE_VENUE', {
    venueId: deleted.id,
    venueName: deleted.name,
    details: { name: deleted.name, neighbourhood: deleted.neighbourhood_name_de },
  });
  res.json({ message: 'Deleted' });
});

// Add a new brand to an existing venue.
app.post('/api/admin/venues/:id/beers', authMiddleware, (req, res) => {
  const venue = getVenueAdmin(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const { brand, size_05, size_mass, serve_type, serving_volume_ml } = req.body || {};
  if (!brand || size_05 == null || !isSanePrice(parseFloat(size_05))) {
    return res.status(400).json({ error: 'brand and a valid size_05 are required' });
  }
  const volume = parseNewServingVolume(serving_volume_ml);
  if (!volume.ok) return res.status(400).json({ error: 'Invalid serving_volume_ml' });
  if (size_mass && !isSanePrice(parseFloat(size_mass))) {
    return res.status(400).json({ error: 'Invalid size_mass' });
  }
  if (venue.beers.some((b) => b.brand.toLowerCase() === String(brand).toLowerCase())) {
    return res.status(400).json({ error: 'This venue already lists that brand' });
  }

  addBeerToVenue(venue.id, {
    brand,
    size_05: parseFloat(size_05),
    size_mass: size_mass ? parseFloat(size_mass) : null,
    serve_type,
    serving_volume_ml: volume.value,
    price_observed_at: todayISO(),
    source_type: 'ADMIN',
    record_history_by: req.user?.username || 'admin',
  });
  logAdminAction('ADD_BEER', {
    venueId: venue.id,
    venueName: venue.name,
    details: { brand, price: parseFloat(size_05), size: wireSizeFor(volume.value), serving_volume_ml: volume.value, serve_type: normalizeServeType(serve_type) },
  });
  res.status(201).json(attachFlags(getVenueAdmin(venue.id)));
});

// Edit one beer's price directly (admin override — separate from the
// submit-and-approve workflow, no submission record is created).
app.patch('/api/admin/venues/:id/beers/:beerId', authMiddleware, (req, res) => {
  const {
    size_05, size_mass, serve_type, serving_volume_ml, price_observed_at, source_type, notes,
  } = req.body || {};
  if (size_05 == null || !isSanePrice(parseFloat(size_05))) {
    return res.status(400).json({ error: 'A valid size_05 is required' });
  }
  if (size_mass && !isSanePrice(parseFloat(size_mass))) {
    return res.status(400).json({ error: 'Invalid size_mass' });
  }
  // Optional. null = "serving size unknown"; anything else must be a size we
  // actually support.
  let resolvedVolume;
  if (serving_volume_ml !== undefined) {
    resolvedVolume = serving_volume_ml === null ? null : Number(serving_volume_ml);
    if (resolvedVolume !== null && !isValidVolume(resolvedVolume)) {
      return res.status(400).json({ error: 'Invalid serving_volume_ml' });
    }
  }
  // When the price was actually seen. Blank/absent = "not provided" (never
  // invented here); a given date must be a real one and not in the future.
  let resolvedObserved;
  if (price_observed_at !== undefined && price_observed_at !== null && price_observed_at !== '') {
    const checked = validateVisitDate(price_observed_at);
    if (!checked.ok) return res.status(400).json({ error: checked.error.replace('visit_date', 'price_observed_at') });
    resolvedObserved = checked.value;
  }
  let resolvedSource;
  if (source_type !== undefined) {
    if (source_type === null || source_type === '') resolvedSource = null;
    else if (isValidSourceType(source_type)) resolvedSource = source_type;
    else return res.status(400).json({ error: 'Invalid source_type' });
  }
  // Internal note — never returned by any public route.
  let resolvedNotes;
  if (notes !== undefined) {
    if (notes !== null && typeof notes !== 'string') return res.status(400).json({ error: 'Invalid notes' });
    resolvedNotes = String(notes ?? '').trim();
    if (resolvedNotes.length > NOTES_MAX_LENGTH) {
      return res.status(400).json({ error: `notes can be at most ${NOTES_MAX_LENGTH} characters` });
    }
  }

  const venueBefore = getVenueAdmin(req.params.id);
  const beerBefore = venueBefore?.beers.find((b) => b.id === Number(req.params.beerId));

  const ok = updateBeerPrice(req.params.id, Number(req.params.beerId), {
    size_05: parseFloat(size_05),
    size_mass: size_mass ? parseFloat(size_mass) : null,
    // Omitted entirely (not just falsy) when the edit form doesn't send a
    // serve_type at all — updateBeerPrice then leaves the existing value alone.
    ...(serve_type !== undefined ? { serve_type } : {}),
    ...(resolvedVolume !== undefined ? { serving_volume_ml: resolvedVolume } : {}),
    ...(resolvedObserved !== undefined ? { price_observed_at: resolvedObserved } : {}),
    ...(resolvedSource !== undefined ? { source_type: resolvedSource } : {}),
    ...(resolvedNotes !== undefined ? { notes: resolvedNotes } : {}),
  }, { changedBy: req.user?.username || 'admin' });
  if (!ok) return res.status(404).json({ error: 'Beer not found for this venue' });

  // A direct admin override has no submission/approval step, so this EDIT_BEER
  // entry is its audit trail. What changed is read back from the database
  // (updateBeerPrice is the single authority on what counts as a change), so a
  // no-op save leaves no entry and every real change lists exactly its fields.
  const beerAfter = getVenueAdmin(req.params.id)?.beers.find((b) => b.id === Number(req.params.beerId));
  if (beerBefore && beerAfter) {
    const TRACKED = ['size_05', 'size_mass', 'serve_type', 'serving_volume_ml', 'price_observed_at', 'verified_at', 'source_type', 'notes'];
    const changedFields = TRACKED.filter((f) => (beerBefore[f] ?? null) !== (beerAfter[f] ?? null));
    if (changedFields.length) {
      logAdminAction('EDIT_BEER', {
        venueId: req.params.id,
        venueName: venueBefore.name,
        performedBy: req.user?.username || 'admin',
        details: {
          brand: beerBefore.brand,
          old_price: beerBefore.size_05,
          new_price: beerAfter.size_05,
          changed_fields: changedFields,
          // Notes are internal free text: log THAT they changed, not their content.
          ...Object.fromEntries(changedFields
            .filter((f) => f !== 'notes' && f !== 'size_05')
            .flatMap((f) => [[`old_${f}`, beerBefore[f] ?? null], [`new_${f}`, beerAfter[f] ?? null]])),
        },
      });
    }
  }

  res.json(attachFlags(getVenueAdmin(req.params.id)));
});

// Full price history of one beer (admin only — it names submitters and admins).
app.get('/api/admin/venues/:id/beers/:beerId/history', authMiddleware, (req, res) => {
  const history = getBeerHistory(req.params.id, Number(req.params.beerId));
  if (!history) return res.status(404).json({ error: 'Beer not found for this venue' });
  res.json(history);
});

// ─── DATA QUALITY (admin) ────────────────────────────────────────────────────
// Flags are for human review only: nothing here edits, deletes or "fixes" data.
app.get('/api/admin/data-quality', authMiddleware, (req, res) => {
  const { venues, flags, dismissed_count } = getDataQuality();
  const grouped = groupFlagsByVenue(flags, venues).map((group) => {
    const venue = venues.find((v) => v.id === group.venue_id);
    return {
      ...group,
      flags: group.flags.map((f) => {
        const beer = f.beer_id ? venue.beers.find((b) => b.id === f.beer_id) : null;
        return {
          ...f,
          beer: beer ? {
            price: beer.size_05, serving_volume_ml: beer.serving_volume_ml,
            normalized_500ml_price: beer.normalized_500ml_price, freshness_state: beer.freshness_state,
            price_observed_at: beer.price_observed_at, verified_at: beer.verified_at,
          } : null,
        };
      }),
    };
  });
  res.json({
    generated_at: new Date().toISOString(),
    thresholds: THRESHOLDS,
    summary: { ...summarizeFlags(flags), dismissed_active: dismissed_count },
    // What "Bulk Verify All Prices" would mark right now — shown in its confirmation.
    unverified_count: countUnverifiedPrices(),
    venues: grouped,
  });
});

// "Bulk Verify All Prices": stamps verified_at = today on EVERY priced, live
// beer that has none. This is a deliberate, blunt admin decision — it says
// "I vouch for all of these as of today", not "each was individually observed" —
// so it needs an explicit { confirm: true } (the UI asks first) and leaves a
// BULK_VERIFY audit entry plus a Telegram notice. It touches only verified_at:
// no price, `updated`, observation date or price history changes. When there is
// nothing to verify it does nothing and records nothing.
app.post('/api/admin/bulk-verify', authMiddleware, (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Bulk verify must be confirmed ({ "confirm": true })' });
  const admin = req.user?.username || 'admin';
  const { count, verified_at } = bulkVerifyPrices();
  if (count > 0) {
    logAdminAction('BULK_VERIFY', { performedBy: admin, details: { count, verified_at } });
    // Fire-and-forget; sendTelegramMessage swallows its own errors.
    notifyBulkVerified({ count, admin });
  }
  res.json({ count, verified_at });
});

// "Dismiss": hide ONE flag for 7 days. It fixes nothing and deletes nothing —
// when the week is up the flag simply reappears if the problem is still there.
app.post('/api/admin/data-quality/dismiss', authMiddleware, (req, res) => {
  const { flag, venue_id, beer_id } = req.body || {};
  if (!FLAG_CODES.includes(flag)) return res.status(400).json({ error: 'Unknown flag' });
  const venue = getVenueAdmin(venue_id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  let beer = null;
  if (beer_id != null && beer_id !== 0) {
    beer = venue.beers.find((b) => b.id === Number(beer_id));
    if (!beer) return res.status(404).json({ error: 'Beer not found for this venue' });
  }
  const until = dismissFlag({ flag, venue_id, beer_id: beer ? beer.id : 0, by: req.user?.username || 'admin' });
  logAdminAction('DISMISS_FLAG', {
    venueId: venue.id,
    venueName: venue.name,
    performedBy: req.user?.username || 'admin',
    details: { flag, brand: beer ? beer.brand : null, dismissed_until: until },
  });
  res.json({ dismissed_until: until });
});

// "This price is still correct." Sets verified_at and nothing else — see
// verifyBeerPrice. Deliberately its own action, not a variant of the price
// edit: confirming an unchanged price is not a price change, so it changes
// no price, no technical `updated`, and creates no price-history entry.
app.post('/api/admin/venues/:id/beers/:beerId/verify', authMiddleware, (req, res) => {
  const venueBefore = getVenueAdmin(req.params.id);
  if (!venueBefore) return res.status(404).json({ error: 'Venue not found' });

  const result = verifyBeerPrice(req.params.id, Number(req.params.beerId));
  if (result === 'not_found') return res.status(404).json({ error: 'Beer not found for this venue' });
  if (result === 'no_price') return res.status(400).json({ error: 'This beer has no price to verify' });

  logAdminAction('VERIFY_PRICE', {
    venueId: req.params.id,
    venueName: venueBefore.name,
    performedBy: req.user?.username || 'admin',
    details: { brand: result.brand, price: result.price, previous_verified_at: result.previous_verified_at },
  });
  // Fire-and-forget: sendTelegramMessage swallows its own errors, so a Telegram
  // outage can never fail (or slow) the verification itself.
  notifyPriceVerified({ venueName: venueBefore.name, price: result.price, admin: req.user?.username || 'admin' });
  res.json(attachFlags(getVenueAdmin(req.params.id)));
});

// Remove one beer from a venue outright — a venue must always keep at least one.
app.delete('/api/admin/venues/:id/beers/:beerId', authMiddleware, (req, res) => {
  const venueBefore = getVenueAdmin(req.params.id);
  const beer = venueBefore?.beers.find((b) => b.id === Number(req.params.beerId));
  const result = deleteBeer(req.params.id, Number(req.params.beerId));
  if (result === 'not_found') return res.status(404).json({ error: 'Beer not found for this venue' });
  if (result === 'last_beer') return res.status(400).json({ error: 'A venue must keep at least one beer' });
  if (beer) {
    logAdminAction('DELETE_BEER', {
      venueId: req.params.id,
      venueName: venueBefore.name,
      details: { brand: beer.brand },
    });
  }
  res.json(attachFlags(getVenueAdmin(req.params.id)));
});

// ─── ADMIN CITY MANAGEMENT ───────────────────────────────────────────────────

// Same shape as the public GET /api/cities — admin just also sees inactive
// rows there's currently no admin-only field to add, so it's the same call.
app.get('/api/admin/cities', authMiddleware, (req, res) => {
  res.json(getCities());
});

app.post('/api/admin/cities', authMiddleware, (req, res) => {
  const { name, name_en, country_code, lat, lng, zoom_level, is_active, coming_soon } = req.body || {};
  if (!name || !String(name).trim() || !name_en || !String(name_en).trim() || !country_code) {
    return res.status(400).json({ error: 'name, name_en and country_code are required' });
  }
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (Number.isNaN(numLat) || Number.isNaN(numLng)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  const id = createCity({
    name: String(name).trim(),
    name_en: String(name_en).trim(),
    country_code: String(country_code).trim().toUpperCase(),
    lat: numLat,
    lng: numLng,
    zoom_level: zoom_level != null && zoom_level !== '' ? parseInt(zoom_level, 10) : 13,
    is_active: !!is_active,
    coming_soon: !!coming_soon,
  });
  res.status(201).json(getCities().find((c) => c.id === id));
});

// Full edit — name/name_en/country_code/coordinates/zoom plus the
// active/coming-soon toggles, all in one PATCH (mirrors the venue edit route).
app.patch('/api/admin/cities/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const { name, name_en, country_code, lat, lng, zoom_level, is_active, coming_soon } = req.body || {};
  if (!name || !String(name).trim() || !name_en || !String(name_en).trim() || !country_code) {
    return res.status(400).json({ error: 'name, name_en and country_code are required' });
  }
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (Number.isNaN(numLat) || Number.isNaN(numLng)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  const ok = updateCity(id, {
    name: String(name).trim(),
    name_en: String(name_en).trim(),
    country_code: String(country_code).trim().toUpperCase(),
    lat: numLat,
    lng: numLng,
    zoom_level: zoom_level != null && zoom_level !== '' ? parseInt(zoom_level, 10) : 13,
    is_active: !!is_active,
    coming_soon: !!coming_soon,
  });
  if (!ok) return res.status(404).json({ error: 'City not found' });
  res.json(getCities().find((c) => c.id === id));
});

// ─── ADMIN ACTIVITY LOG ──────────────────────────────────────────────────────

// One row per mutating admin action (see the ACTION_TYPE list next to each
// logAdminAction() call above) — powers the "📋 Activity Log" admin tab.
app.get('/api/admin/logs', authMiddleware, (req, res) => {
  const { page, action_type, venue, from, to } = req.query;
  res.json(getAdminLogs({ page, action_type, venue, from, to }));
});

// Same filters as the list above, no pagination — a plain CSV of every
// matching row. The frontend fetches this with its auth header and saves the
// response as a blob (a plain <a href> can't carry the Authorization header).
function toCsvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function logsToCsv(rows) {
  const header = ['id', 'timestamp', 'action_type', 'venue_name', 'details', 'performed_by'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.id, r.created_at, r.action_type, r.venue_name,
      r.details ? JSON.stringify(r.details) : '', r.performed_by,
    ].map(toCsvCell).join(','));
  }
  return lines.join('\r\n');
}
app.get('/api/admin/logs/export', authMiddleware, (req, res) => {
  const { action_type, venue, from, to } = req.query;
  const rows = getAdminLogsForExport({ action_type, venue, from, to });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="bierpreis-admin-logs.csv"');
  res.send(logsToCsv(rows));
});

app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const byStatus = {};
  for (const row of S.countSubmissionsByStatus.all()) byStatus[row.status] = row.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  res.json({
    total_venues: S.countVenues.get().n,
    total_submissions: total,
    pending: byStatus.pending || 0,
    approved: byStatus.approved || 0,
    rejected: byStatus.rejected || 0,
    outliers: S.countPendingOutliers.get().n,
  });
});

// ─── PRODUCTION STATIC SERVING ────────────────────────────────────────────────
// Serves the built frontend (frontend/dist) from this same Node process, so one
// deploy handles both the API and the site. Only active when NODE_ENV=production
// — in dev, the frontend runs separately via `vite`.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'frontend/dist')));
  // Express 5's router (path-to-regexp v8) rejects a bare '*' pattern in
  // app.get('*', ...) — it requires a named wildcard like '/*splat'. A plain
  // app.use() catch-all sidesteps path pattern parsing entirely and is
  // otherwise identical: serve the SPA shell for any non-API GET so client-side
  // routing works on a hard refresh/deep link.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🍺 Bierpreis API running on http://localhost:${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
  notifyStartup();
});
