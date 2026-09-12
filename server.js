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
  getVenues,
  getVenue,
  getVenuesAdmin,
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
  notifyApproved,
  notifyStartup,
} = require('./backend/notifications');

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

// German + English words that should match each venue `type` in free-text search.
const TYPE_SEARCH_TERMS = {
  beer_garden: ['biergarten', 'beer garden', 'garden'],
  beer_hall: ['wirtshaus', 'bierhalle', 'bierhaus', 'beer hall', 'inn'],
  bar: ['bar', 'kneipe'],
  restaurant: ['restaurant', 'gaststätte', 'gaststaette'],
};

// Every string a free-text query (`q`) is matched against, lower-cased.
function venueSearchHaystack(v) {
  return [
    v.name,
    v.address,
    v.neighbourhood_id,
    v.neighbourhood_name_de,
    v.neighbourhood_name_en,
    ...v.beers.map((b) => b.brand),
    ...(TYPE_SEARCH_TERMS[v.type] || [v.type]),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
}

app.get('/api/venues', (req, res) => {
  let result = getVenues();
  const { neighbourhood, type, brand, min_price, max_price, q } = req.query;

  if (neighbourhood) result = result.filter((v) => v.neighbourhood_id === neighbourhood);
  if (type) result = result.filter((v) => v.type === type);
  if (brand) {
    const bl = brand.toLowerCase();
    result = result.filter((v) => v.beers.some((b) => b.brand.toLowerCase().includes(bl)));
  }
  if (min_price) result = result.filter((v) => v.beers[0] && v.beers[0].size_05 >= parseFloat(min_price));
  if (max_price) result = result.filter((v) => v.beers[0] && v.beers[0].size_05 <= parseFloat(max_price));
  if (q && q.trim()) {
    const ql = q.trim().toLowerCase();
    result = result.filter((v) => venueSearchHaystack(v).some((s) => s.includes(ql)));
  }

  res.json(result);
});

app.get('/api/venues/:id', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Not found' });

  const price_history = S.approvedHistoryForVenue.all(req.params.id);
  res.json({ ...venue, price_history });
});

// ─── SUBMISSIONS ─────────────────────────────────────────────────────────────

// Every field the new_venue-only columns need, defaulted to null so a single
// INSERT statement (with @named params) works for every report_type.
const BLANK_NEW_VENUE_FIELDS = {
  venue_type: null, neighbourhood_id: null, address: null, lat: null, lng: null,
  size_mass: null, photo_path: null,
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
    visit_date,
    submitter_name,
    note,
  } = req.body || {};

  const VALID_TYPES = ['price_change', 'new_beer', 'closed', 'other_info'];
  if (!VALID_TYPES.includes(report_type)) {
    return res.status(400).json({ error: 'Invalid report_type' });
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
  }
  if (!venue_id) {
    return res.status(400).json({ error: 'venue_id is required' });
  }
  if (report_type === 'other_info' && !note?.trim()) {
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
    const beer = venue.beers.find((b) => b.brand === beer_brand);
    if (beer) {
      const currentPrice = size === '1L' ? beer.size_mass : beer.size_05;
      if (currentPrice && Math.abs(numPrice - currentPrice) / currentPrice > 0.25) {
        isOutlier = true;
      }
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
    visit_date: visit_date || new Date().toISOString().split('T')[0],
    submitter_name: submitter_name || 'Anonym',
    note: note || '',
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
  }

  res.status(201).json({ message: 'Submitted successfully', id: submission.id, is_outlier: isOutlier });
});

// The "🍺 Missing a bar?" flow — a full new-venue proposal, with an optional
// photo, so this is multipart/form-data rather than JSON.
app.post('/api/submissions/new-venue', upload.single('photo'), (req, res) => {
  const {
    name, type, neighbourhood_id, address, lat, lng,
    beer_brand, size_05, size_mass, visit_date, submitter_name, note,
  } = req.body || {};

  if (!name || !type || !neighbourhood_id || !beer_brand || !size_05) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'name, type, neighbourhood_id, beer_brand and size_05 are required' });
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

  const submission = {
    id: nextSubmissionId(),
    report_type: 'new_venue',
    venue_id: null,
    venue_name: name,
    is_new_venue: 1,
    beer_brand,
    size: '0.5L',
    price: numPrice,
    visit_date: visit_date || new Date().toISOString().split('T')[0],
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
app.get('/api/admin/submissions', authMiddleware, (req, res) => {
  const { status } = req.query;
  const rows = status ? S.submissionsByStatus.all(status) : S.allSubmissions.all();
  res.json(rows);
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
  if (status === 'approved') {
    // Captured for the APPROVE log entry below — null for a brand-new venue
    // (nothing to compare against) or for closed/other_info (no price at all).
    let oldPrice = null;

    if (sub.report_type === 'new_venue') {
      // Build the venue from the captured proposal and materialise it — it then
      // shows up on the map/lists on the next fetch, no other wiring needed.
      createdVenueId = createVenue(
        {
          name: sub.venue_name,
          type: sub.venue_type,
          neighbourhood_id: sub.neighbourhood_id,
          address: sub.address,
          lat: sub.lat,
          lng: sub.lng,
        },
        [{ brand: sub.beer_brand, size_05: sub.price, size_mass: sub.size_mass }],
      );
      S.setSubmissionVenueId.run(createdVenueId, sub.id);
    } else if (sub.venue_id && sub.beer_brand && sub.price != null) {
      // price_change or new_beer: roll the price into that specific brand's row
      // if the venue already lists it, otherwise add it as a new beer — either
      // way this must never touch the wrong brand (a venue can list several).
      const venue = getVenueAdmin(sub.venue_id);
      const existingBeer = venue?.beers.find((b) => b.brand === sub.beer_brand);
      if (existingBeer) {
        oldPrice = sub.size === '1L' ? existingBeer.size_mass : existingBeer.size_05;
        S.updateHeadlinePrice.run({
          venue_id: sub.venue_id,
          brand: sub.beer_brand,
          size: sub.size,
          price: sub.price,
          visit_date: sub.visit_date,
        });
      } else {
        const size_05 = sub.size === '0.5L' ? sub.price : Math.round((sub.price / 2) * 20) / 20;
        const size_mass = sub.size === '1L' ? sub.price : null;
        addBeerToVenue(sub.venue_id, { brand: sub.beer_brand, size_05, size_mass });
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
    }
    // 'other_info' reports carry no automated DB action — the admin reads the
    // note and acts on it manually (e.g. via Manage Venues).

    logAdminAction('APPROVE', {
      venueId: createdVenueId || sub.venue_id,
      venueName: sub.venue_name,
      details: { submission_id: sub.id, old_price: oldPrice, new_price: sub.price, brand: sub.beer_brand },
    });
    if (sub.price != null) {
      notifyApproved({ venueName: sub.venue_name, price: sub.price });
    }
  } else if (status === 'rejected') {
    logAdminAction('REJECT', {
      venueId: sub.venue_id,
      venueName: sub.venue_name,
      details: { submission_id: sub.id, reason: reject_reason || null },
    });
  }

  const updated = S.submissionById.get(sub.id);
  res.json({ message: 'Updated', submission: updated, venue_id: createdVenueId });
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
  if (!Array.isArray(beers) || beers.length === 0) {
    return res.status(400).json({ error: 'At least one beer is required' });
  }
  for (const b of beers) {
    if (!b.brand || b.size_05 == null || Number.isNaN(parseFloat(b.size_05))) {
      return res.status(400).json({ error: 'Each beer needs a brand and a 0.5L price' });
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
      })),
    );
    const nHood = getNeighbourhoods().find((n) => n.id === neighbourhood_id);
    logAdminAction('ADD_VENUE', {
      venueId: id,
      venueName: name,
      details: { name, neighbourhood: nHood?.name_de || neighbourhood_id, type },
    });
    res.status(201).json(getVenueAdmin(id));
  } catch (err) {
    console.error('Failed to create venue:', err);
    res.status(500).json({ error: 'Could not create venue' });
  }
});

// Manage Venues table — every venue including inactive ones (the public GET
// /api/venues hides those, but an admin still needs to see & re-activate them).
app.get('/api/admin/venues', authMiddleware, (req, res) => {
  res.json(getVenuesAdmin());
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
  const VALID_TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];
  if (!VALID_TYPES.includes(type)) {
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

  res.json(getVenueAdmin(req.params.id));
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

  const { brand, size_05, size_mass } = req.body || {};
  if (!brand || size_05 == null || Number.isNaN(parseFloat(size_05))) {
    return res.status(400).json({ error: 'brand and size_05 are required' });
  }
  if (venue.beers.some((b) => b.brand.toLowerCase() === String(brand).toLowerCase())) {
    return res.status(400).json({ error: 'This venue already lists that brand' });
  }

  addBeerToVenue(venue.id, {
    brand,
    size_05: parseFloat(size_05),
    size_mass: size_mass ? parseFloat(size_mass) : null,
  });
  logAdminAction('ADD_BEER', {
    venueId: venue.id,
    venueName: venue.name,
    details: { brand, price: parseFloat(size_05), size: '0.5L' },
  });
  res.status(201).json(getVenueAdmin(venue.id));
});

// Edit one beer's price directly (admin override — separate from the
// submit-and-approve workflow, no submission record is created).
app.patch('/api/admin/venues/:id/beers/:beerId', authMiddleware, (req, res) => {
  const { size_05, size_mass } = req.body || {};
  if (size_05 == null || Number.isNaN(parseFloat(size_05))) {
    return res.status(400).json({ error: 'size_05 is required' });
  }
  const ok = updateBeerPrice(req.params.id, Number(req.params.beerId), {
    size_05: parseFloat(size_05),
    size_mass: size_mass ? parseFloat(size_mass) : null,
  });
  if (!ok) return res.status(404).json({ error: 'Beer not found for this venue' });
  res.json(getVenueAdmin(req.params.id));
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
  res.json(getVenueAdmin(req.params.id));
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
