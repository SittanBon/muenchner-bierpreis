// SQLite data layer for Bierpreis v3.
// Opens a single better-sqlite3 connection, applies the schema, and exposes
// query helpers that return the exact JSON shapes the frontend expects.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  SIZE_TO_ML,
  REFERENCE_VOLUME_ML,
  normalizePrice,
  getFreshness,
  todayISO,
  toDateOnly,
  volumeFromSize,
  resolveObservationDates,
  isValidSourceType,
} = require('../utils/priceUtils');
const { computeFlags, flagKey, THRESHOLDS } = require('../dataQuality');

// Railway mounts the persistent volume at /app/data — without DATABASE_PATH
// explicitly pointing there, a production deploy would silently fall back to
// a path inside the container's own (ephemeral) filesystem, and every
// redeploy would wipe the database. Defaulting the production path itself to
// the volume is a safety net for exactly that case: DATABASE_PATH is still
// the source of truth when set (e.g. to override the volume's mount point),
// but production is never one missing env var away from losing its data.
const DEFAULT_PATH = process.env.NODE_ENV === 'production'
  ? '/app/data/bierpreis.db'
  : path.join(__dirname, 'bierpreis.db'); // ./backend/db/bierpreis.db in development
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : DEFAULT_PATH;

// Creates the volume's directory on first boot if it isn't there yet —
// recursive:true makes this a no-op (not an error) on every later boot once
// it already exists.
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  migrate();
}

// A consistent point-in-time copy of the database (VACUUM INTO, not a raw
// file copy — the DB runs in WAL mode, so copying the main file alone can miss
// committed data still sitting in the -wal sidecar) written next to the DB
// file, taken once, right before a schema migration that touches real data.
// Restoring it is the rollback path. A failed backup is logged loudly but
// doesn't block the migration: the migrations here only ADD columns.
function backupBeforeMigration(label) {
  try {
    if (db.prepare('SELECT COUNT(*) AS n FROM beers').get().n === 0) return; // nothing worth saving
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = `${DB_PATH}.pre-${label}-${stamp}.bak`;
    db.prepare('VACUUM INTO ?').run(target);
    console.log(`🛟 Pre-migration backup written: ${target}`);
  } catch (err) {
    console.error(`⚠️  Pre-migration backup FAILED (${err.message}) — continuing, the migration only adds columns.`);
  }
}

// CREATE TABLE IF NOT EXISTS leaves an already-existing `beers` table without new
// columns added to schema.sql later — add them by hand, guarded so this is safe
// to run on every boot.
function migrate() {
  const beerCols = db.prepare('PRAGMA table_info(beers)').all().map((c) => c.name);
  if (!beerCols.includes('active')) {
    db.exec('ALTER TABLE beers ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
  // DEFAULT 'unknown' backfills every pre-existing beer row in the same statement.
  if (!beerCols.includes('serve_type')) {
    db.exec("ALTER TABLE beers ADD COLUMN serve_type TEXT NOT NULL DEFAULT 'unknown'");
  }
  const submissionCols = db.prepare('PRAGMA table_info(submissions)').all().map((c) => c.name);
  if (!submissionCols.includes('serve_type')) {
    db.exec('ALTER TABLE submissions ADD COLUMN serve_type TEXT');
  }
  if (!submissionCols.includes('extra_beers')) {
    db.exec('ALTER TABLE submissions ADD COLUMN extra_beers TEXT');
  }
  // P0 Phase 1 — price trust columns. `beers.updated` stays exactly as it is
  // but is now only a technical modification date; freshness comes from these:
  //   price_observed_at — when this price was actually seen/reported
  //   verified_at       — when someone later confirmed it is still correct
  //   serving_volume_ml — the serving size `size_05` is quoted for (ml)
  // Both dates are added NULL for every existing row on purpose: nothing in
  // the legacy data proves a price was observed or verified (`updated` is a
  // mix of seed-script staggering, admin-edit dates and user-claimed dates),
  // so copying it across would manufacture trust. Existing rows read as
  // "date unknown" until a real observation/verification is recorded.
  // serving_volume_ml is backfilled to 500 because `size_05` IS, by
  // definition, the 0.5 L price. The backfill sits inside the "column is
  // missing" branch so it runs exactly once — never on a later boot, where it
  // could overwrite real data.
  const beerColsNow = db.prepare('PRAGMA table_info(beers)').all().map((c) => c.name);
  const missingTrustCols = ['price_observed_at', 'verified_at', 'serving_volume_ml']
    .filter((c) => !beerColsNow.includes(c));
  if (missingTrustCols.length) {
    backupBeforeMigration('phase1');
    if (!beerColsNow.includes('price_observed_at')) db.exec('ALTER TABLE beers ADD COLUMN price_observed_at TEXT');
    if (!beerColsNow.includes('verified_at')) db.exec('ALTER TABLE beers ADD COLUMN verified_at TEXT');
    if (!beerColsNow.includes('serving_volume_ml')) {
      db.exec('ALTER TABLE beers ADD COLUMN serving_volume_ml INTEGER');
      db.exec(`UPDATE beers SET serving_volume_ml = ${REFERENCE_VOLUME_ML} WHERE size_05 IS NOT NULL`);
    }
  }
  // P0 Phase 2 — where the current price came from + an internal admin note.
  // Both start NULL for every existing row: source tracking didn't exist, and
  // guessing "ADMIN" or "COMMUNITY" for old prices would be inventing
  // provenance. (price_history and flag_dismissals are new tables — schema.sql
  // creates them; they need no migration.)
  const beerColsP2 = db.prepare('PRAGMA table_info(beers)').all().map((c) => c.name);
  const missingP2 = ['source_type', 'notes'].filter((c) => !beerColsP2.includes(c));
  if (missingP2.length) {
    backupBeforeMigration('phase2');
    if (!beerColsP2.includes('source_type')) db.exec('ALTER TABLE beers ADD COLUMN source_type TEXT');
    if (!beerColsP2.includes('notes')) db.exec('ALTER TABLE beers ADD COLUMN notes TEXT');
  }
  const venueCols = db.prepare('PRAGMA table_info(venues)').all().map((c) => c.name);
  if (!venueCols.includes('active')) {
    db.exec('ALTER TABLE venues ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
  // Flags a venue whose real address falls outside all 6 modelled
  // neighbourhood polygons (e.g. Haidhausen, Au, Sendling — districts this
  // app doesn't have boundary data for yet) and was assigned to its nearest
  // neighbourhood by centroid distance rather than genuine polygon
  // containment, so the admin UI can visibly flag it as approximate.
  if (!venueCols.includes('outside_modelled_area')) {
    db.exec('ALTER TABLE venues ADD COLUMN outside_modelled_area INTEGER NOT NULL DEFAULT 0');
  }
  // city_id scopes a neighbourhood to one of the `cities` rows. DEFAULT 1
  // backfills every pre-existing neighbourhood to Munich in the same statement.
  const neighbourhoodCols = db.prepare('PRAGMA table_info(neighbourhoods)').all().map((c) => c.name);
  if (!neighbourhoodCols.includes('city_id')) {
    db.exec('ALTER TABLE neighbourhoods ADD COLUMN city_id INTEGER DEFAULT 1');
  }
  // Optional short display name for the stats-bar pill — a neighbourhood
  // whose official long name_en reads awkwardly as a pill label (e.g.
  // "Altstadt-Lehel" / "Old Town & Lehel") can pin one literal string for
  // both languages via short_name_de/short_name_en; StatsBar falls back to
  // name_de/name_en when these are NULL.
  if (!neighbourhoodCols.includes('short_name_de')) {
    db.exec('ALTER TABLE neighbourhoods ADD COLUMN short_name_de TEXT');
  }
  if (!neighbourhoodCols.includes('short_name_en')) {
    db.exec('ALTER TABLE neighbourhoods ADD COLUMN short_name_en TEXT');
  }
  // One-time seed of the cities table itself (schema.sql only creates the table,
  // it doesn't populate it) — guarded so a re-run never duplicates rows.
  const cityCount = db.prepare('SELECT COUNT(*) AS n FROM cities').get().n;
  if (cityCount === 0) {
    db.exec(`
      INSERT INTO cities (id, name, name_en, country_code, lat, lng, zoom_level, is_active, coming_soon) VALUES
        (1, 'München', 'Munich',  'DE', 48.1374, 11.5755, 13, 1, 0),
        (2, 'Berlin',  'Berlin',  'DE', 52.5200, 13.4050, 12, 0, 1),
        (3, 'Hamburg', 'Hamburg', 'DE', 53.5511, 9.9937,  12, 0, 1),
        (4, 'Wien',    'Vienna',  'AT', 48.2082, 16.3738, 12, 0, 1)
    `);
  }
}

// Ensure tables exist before any prepared statement below is compiled.
initSchema();

function isEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM venues').get().n === 0;
}

// ─── Read helpers ────────────────────────────────────────────────────────────

// The per-0.5 L comparison price of a `beers` row, as SQL — for ORDER BY and
// AVG() where the JS normalizePrice() can't run. Same formula (price / volume
// × 500); backend/normalizationParity.test.js proves it agrees with
// normalizePrice for every supported size. Only meaningful for rows with
// size_05 > 0 AND serving_volume_ml > 0 (callers guard that).
const BEER_PRICE_500_SQL = `size_05 * ${REFERENCE_VOLUME_ML}.0 / serving_volume_ml`;

// Cheapest active beer first — every consumer that reads beers[0] as "the
// headline price" (stats, map shading, sidebar cards, venue detail) gets the
// cheapest brand for free, with no special-casing needed at the call site.
//
// "Cheapest" means cheapest per 0.5 L (size_05 × 500 / serving_volume_ml), not
// the smallest raw number — €3.50 for 0.33 L is NOT cheaper than €4.20 for
// 0.5 L. A price with no known serving size can't be compared, so it sorts
// after every comparable one instead of being assumed to be 0.5 L.
const beersForVenue = db.prepare(
  `SELECT id, venue_id, brand, size_05, size_mass, updated, reports, serve_type,
          serving_volume_ml, price_observed_at, verified_at
     FROM beers WHERE venue_id = ? AND active = 1
    ORDER BY CASE WHEN serving_volume_ml > 0 AND size_05 > 0 THEN 0 ELSE 1 END,
             ${BEER_PRICE_500_SQL} ASC,
             id ASC`
);

// The admin variant of the same query adds the two ADMIN-ONLY columns —
// source_type and the internal notes. They are deliberately absent from
// beersForVenue, so they can never reach a public response.
const beersForVenueAdmin = db.prepare(
  `SELECT id, venue_id, brand, size_05, size_mass, updated, reports, serve_type,
          serving_volume_ml, price_observed_at, verified_at, source_type, notes
     FROM beers WHERE venue_id = ? AND active = 1
    ORDER BY CASE WHEN serving_volume_ml > 0 AND size_05 > 0 THEN 0 ELSE 1 END,
             ${BEER_PRICE_500_SQL} ASC,
             id ASC`
);

// Adds the server-derived fields every public/admin beer carries: the price
// normalised to 0.5 L (null when the serving size or price is unknown) and
// the freshness state. The API sends only what the UI needs — no admin ids,
// submitter details or notes ever ride along on a beer.
function hydrateBeer(row) {
  return {
    ...row,
    normalized_500ml_price: normalizePrice(row.size_05, row.serving_volume_ml),
    freshness_state: getFreshness(row).state,
  };
}

const SERVE_TYPES = ['tap', 'bottle', 'can', 'unknown'];
function normalizeServeType(v) {
  return SERVE_TYPES.includes(v) ? v : 'unknown';
}

const venueBase = `
  SELECT v.*,
         n.name_de AS neighbourhood_name_de,
         n.name_en AS neighbourhood_name_en
    FROM venues v
    JOIN neighbourhoods n ON n.id = v.neighbourhood_id
`;

// Public reads only ever see active venues; the admin variants see everything
// (an inactive venue must still be reachable in Manage Venues so it can be
// re-activated) — see getVenuesAdmin/getVenueAdmin below.
const allVenuesStmt = db.prepare(`${venueBase} WHERE v.active = 1 ORDER BY v.name`);
const venueByIdStmt = db.prepare(`${venueBase} WHERE v.id = ? AND v.active = 1`);
const allVenuesAdminStmt = db.prepare(`${venueBase} ORDER BY v.name`);
const venueByIdAdminStmt = db.prepare(`${venueBase} WHERE v.id = ?`);

function hydrateVenue(row, { admin = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    neighbourhood_id: row.neighbourhood_id,
    neighbourhood_name_de: row.neighbourhood_name_de,
    neighbourhood_name_en: row.neighbourhood_name_en,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    opening_hours: row.opening_hours,
    website: row.website,
    description_de: row.description_de,
    description_en: row.description_en,
    active: row.active === 1,
    outside_modelled_area: row.outside_modelled_area === 1,
    beers: (admin ? beersForVenueAdmin : beersForVenue).all(row.id).map(hydrateBeer),
  };
}

function getVenues() {
  return allVenuesStmt.all().map(hydrateVenue);
}

function getVenue(id) {
  return hydrateVenue(venueByIdStmt.get(id));
}

function getVenuesAdmin() {
  return allVenuesAdminStmt.all().map((row) => hydrateVenue(row, { admin: true }));
}

function getVenueAdmin(id) {
  return hydrateVenue(venueByIdAdminStmt.get(id), { admin: true });
}

const neighbourhoodsStmt = db.prepare('SELECT * FROM neighbourhoods ORDER BY name_de');

// Neighbourhoods enriched with the average headline (0.5 L) price + venue count.
function getNeighbourhoods() {
  const venues = getVenues();
  return neighbourhoodsStmt.all().map((n) => {
    // Averages compare like with like: every price is the normalised 0.5 L
    // price, and a venue whose serving size is unknown is left out rather
    // than assumed to be 0.5 L.
    const prices = venues
      .filter((v) => v.neighbourhood_id === n.id && v.beers[0]?.normalized_500ml_price != null)
      .map((v) => v.beers[0].normalized_500ml_price);
    const avg = prices.length
      ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
      : null;
    return {
      id: n.id,
      name_de: n.name_de,
      name_en: n.name_en,
      short_name_de: n.short_name_de,
      short_name_en: n.short_name_en,
      center: [n.center_lat, n.center_lng],
      description_de: n.description_de,
      description_en: n.description_en,
      avg_price: avg,
      venue_count: prices.length,
    };
  });
}

// ─── Cities ──────────────────────────────────────────────────────────────────

const citiesStmt = db.prepare('SELECT * FROM cities ORDER BY id');
// Only meaningful for a live (is_active) city — a coming-soon city has no
// neighbourhoods/venues assigned to it yet, so it always reports 0.
const cityVenueCountStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM venues v
    JOIN neighbourhoods nb ON nb.id = v.neighbourhood_id
   WHERE nb.city_id = ? AND v.active = 1
`);

function hydrateCity(row) {
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en,
    country_code: row.country_code,
    lat: row.lat,
    lng: row.lng,
    zoom_level: row.zoom_level,
    is_active: row.is_active === 1,
    coming_soon: row.coming_soon === 1,
    venue_count: row.is_active === 1 ? cityVenueCountStmt.get(row.id).n : 0,
  };
}

function getCities() {
  return citiesStmt.all().map(hydrateCity);
}

const insertCityStmt = db.prepare(`
  INSERT INTO cities (name, name_en, country_code, lat, lng, zoom_level, is_active, coming_soon)
  VALUES (@name, @name_en, @country_code, @lat, @lng, @zoom_level, @is_active, @coming_soon)
`);
const updateCityStmt = db.prepare(`
  UPDATE cities SET
    name = @name, name_en = @name_en, country_code = @country_code,
    lat = @lat, lng = @lng, zoom_level = @zoom_level,
    is_active = @is_active, coming_soon = @coming_soon
  WHERE id = @id
`);
const cityExistsStmt = db.prepare('SELECT 1 FROM cities WHERE id = ?');

function createCity(fields) {
  const info = insertCityStmt.run({
    name: fields.name,
    name_en: fields.name_en,
    country_code: fields.country_code,
    lat: fields.lat,
    lng: fields.lng,
    zoom_level: fields.zoom_level ?? 13,
    is_active: fields.is_active ? 1 : 0,
    coming_soon: fields.coming_soon ? 1 : 0,
  });
  return info.lastInsertRowid;
}

// Returns false if the city doesn't exist.
function updateCity(id, fields) {
  if (!cityExistsStmt.get(id)) return false;
  updateCityStmt.run({
    id,
    name: fields.name,
    name_en: fields.name_en,
    country_code: fields.country_code,
    lat: fields.lat,
    lng: fields.lng,
    zoom_level: fields.zoom_level ?? 13,
    is_active: fields.is_active ? 1 : 0,
    coming_soon: fields.coming_soon ? 1 : 0,
  });
  return true;
}

// ─── Admin activity log ─────────────────────────────────────────────────────

const insertAdminLog = db.prepare(`
  INSERT INTO admin_logs (action_type, venue_id, venue_name, details, performed_by, created_at)
  VALUES (@action_type, @venue_id, @venue_name, @details, @performed_by, @created_at)
`);

// One row per mutating admin action. `details` is whatever small JSON-able
// object is relevant to that action_type (see the ACTION_TYPE comment list in
// server.js) — stored as a JSON string, parsed back out in hydrateLog.
function logAdminAction(actionType, { venueId = null, venueName = null, details = null, performedBy = 'admin' } = {}) {
  insertAdminLog.run({
    action_type: actionType,
    venue_id: venueId,
    venue_name: venueName,
    details: details != null ? JSON.stringify(details) : null,
    performed_by: performedBy,
    created_at: new Date().toISOString(),
  });
}

function hydrateLog(row) {
  let details = row.details;
  if (details) {
    try { details = JSON.parse(details); } catch { /* leave as raw string */ }
  }
  return {
    id: row.id,
    action_type: row.action_type,
    venue_id: row.venue_id,
    venue_name: row.venue_name,
    details,
    performed_by: row.performed_by,
    created_at: row.created_at,
  };
}

// A bare "2026-09-13" `to` filter should include the whole day — as a raw
// string bound against an ISO timestamp column, "2026-09-13" sorts BEFORE
// "2026-09-13T10:23...", which would silently exclude every same-day entry.
function normalizeToDate(to) {
  return to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
}

function logFilterClause({ action_type, venue, from, to } = {}) {
  const clauses = [];
  const params = {};
  if (action_type) { clauses.push('action_type = @action_type'); params.action_type = action_type; }
  if (venue) { clauses.push('venue_name LIKE @venue'); params.venue = `%${venue}%`; }
  if (from) { clauses.push('created_at >= @from'); params.from = from; }
  const toNorm = normalizeToDate(to);
  if (toNorm) { clauses.push('created_at <= @to'); params.to = toNorm; }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// Paginated + filterable — powers the Activity Log tab's table.
function getAdminLogs(filters = {}) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const pageSize = 50;
  const { where, params } = logFilterClause(filters);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM admin_logs ${where}`).get(params).n;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(
    `SELECT * FROM admin_logs ${where} ORDER BY datetime(created_at) DESC, id DESC LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: pageSize, offset });
  return {
    logs: rows.map(hydrateLog),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Same filters, no pagination — feeds the CSV export so it exports every
// matching row, not just the page currently on screen.
function getAdminLogsForExport(filters = {}) {
  const { where, params } = logFilterClause(filters);
  return db.prepare(`SELECT * FROM admin_logs ${where} ORDER BY datetime(created_at) DESC, id DESC`)
    .all(params).map(hydrateLog);
}

// City-wide stats for the public stats bar.
function getStats() {
  // City-wide numbers are per-0.5 L comparison prices (see getNeighbourhoods).
  const venues = getVenues().filter((v) => v.beers[0]?.normalized_500ml_price != null);
  const priced = venues.map((v) => ({
    id: v.id,
    name: v.name,
    neighbourhood_id: v.neighbourhood_id,
    price: v.beers[0].normalized_500ml_price,
  }));

  const cityAvg = priced.length
    ? Math.round((priced.reduce((s, v) => s + v.price, 0) / priced.length) * 100) / 100
    : null;

  const sorted = [...priced].sort((a, b) => a.price - b.price);

  const byNeighbourhood = getNeighbourhoods()
    .filter((n) => n.venue_count > 0)
    .map((n) => ({
      id: n.id,
      name_de: n.name_de,
      name_en: n.name_en,
      short_name_de: n.short_name_de,
      short_name_en: n.short_name_en,
      avg_price: n.avg_price,
      venue_count: n.venue_count,
    }));

  return {
    city_avg: cityAvg,
    venue_count: priced.length,
    cheapest: sorted[0] || null,
    most_expensive: sorted[sorted.length - 1] || null,
    by_neighbourhood: byNeighbourhood,
  };
}

// ─── Submission helpers ─────────────────────────────────────────────────────

const insertSubmission = db.prepare(`
  INSERT INTO submissions
    (id, report_type, venue_id, venue_name, is_new_venue, beer_brand, size, price,
     visit_date, submitter_name, note, status, is_outlier, created_at,
     venue_type, neighbourhood_id, address, lat, lng, size_mass, photo_path,
     serve_type, extra_beers)
  VALUES
    (@id, @report_type, @venue_id, @venue_name, @is_new_venue, @beer_brand, @size, @price,
     @visit_date, @submitter_name, @note, @status, @is_outlier, @created_at,
     @venue_type, @neighbourhood_id, @address, @lat, @lng, @size_mass, @photo_path,
     @serve_type, @extra_beers)
`);

// Highest numeric suffix among the app-issued `s###` ids — NOT a row count.
// A count-based id (the original) collides with an existing id as soon as any
// submission has ever been deleted (e.g. the seeded-estimate cleanup): with
// s037…s041 present and 5 rows left, the sixth new submission would try s011…
// and the 32nd would hit s037 and fail on the primary key. Seeded `h####` ids
// are ignored on purpose (different prefix, can never collide).
const nextSubmissionSeq = db.prepare(
  `SELECT COALESCE(MAX(CAST(SUBSTR(id, 2) AS INTEGER)), 0) AS n FROM submissions WHERE id GLOB 's[0-9]*'`
);

const submissionsByStatus = db.prepare(
  `SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC`
);
const allSubmissions = db.prepare(
  `SELECT * FROM submissions ORDER BY created_at DESC`
);
const submissionById = db.prepare(`SELECT * FROM submissions WHERE id = ?`);
const setSubmissionStatus = db.prepare(
  `UPDATE submissions SET status = @status, reject_reason = @reject_reason WHERE id = @id`
);
const setSubmissionVenueId = db.prepare(`UPDATE submissions SET venue_id = ? WHERE id = ?`);
// Only price_change/new_beer rows carry a real (brand, price) pair — a 'closed'
// or 'other_info' report has neither, so it must never show up as a history point.
// PUBLIC price history: deliberately a column allow-list, not SELECT * — a
// submission row also carries the submitter's name, their free-text note, the
// admin's reject reason and (for new venues) coordinates/photo path, none of
// which belong in a public API response.
const approvedHistoryForVenueStmt = db.prepare(`
  SELECT beer_brand, size, price, visit_date FROM submissions
   WHERE venue_id = ? AND status = 'approved'
     AND beer_brand IS NOT NULL AND price IS NOT NULL
   ORDER BY visit_date DESC
`);

// History rows carry both the price as reported and the same price
// normalised to 0.5 L (null when the reported size isn't a known one), so a
// chart can plot comparable numbers without re-deriving the conversion.
function getPublicPriceHistory(venueId) {
  return approvedHistoryForVenueStmt.all(venueId).map((row) => ({
    ...row,
    normalized_500ml_price: normalizePrice(row.price, volumeFromSize(row.size)),
  }));
}

// Applies an approved "suggest a description" report — the one place a
// venue's description is ever set outside the admin edit form itself.
const setVenueDescriptionDe = db.prepare(
  'UPDATE venues SET description_de = @description_de WHERE id = @venue_id'
);

// Trend averages compare like with like: each submission's price is converted
// to its per-0.5 L equivalent from the size it was reported for, and a
// submission with no recognised size (or no price) is left out entirely
// instead of being averaged in as if it were a 0.5 L price.
const SUBMISSION_ML_SQL = `CASE s.size ${Object.entries(SIZE_TO_ML).map(([k, v]) => `WHEN '${k}' THEN ${v}`).join(' ')} END`;
const SUBMISSION_PRICE_500_SQL = `(s.price * ${REFERENCE_VOLUME_ML}.0 / ${SUBMISSION_ML_SQL})`;
const COMPARABLE_SUBMISSION_SQL = `s.price IS NOT NULL AND ${SUBMISSION_ML_SQL} IS NOT NULL`;

// Monthly average Helles price per neighbourhood, from approved submissions —
// powers the Price Trends chart. Each row is one (month, neighbourhood) average.
// Grouped by v.neighbourhood_id explicitly — submissions now has its own
// neighbourhood_id too (for new_venue proposals), so the bare column name is
// ambiguous once both tables are joined. `n` (row count behind the average)
// powers the trend chart's "X data points" tooltip line.
const trendsByNeighbourhood = db.prepare(`
  SELECT strftime('%Y-%m', s.visit_date) AS month,
         v.neighbourhood_id            AS neighbourhood_id,
         ROUND(AVG(${SUBMISSION_PRICE_500_SQL}), 2) AS avg_price,
         COUNT(*)                      AS n
    FROM submissions s
    JOIN venues v ON v.id = s.venue_id
   WHERE s.status = 'approved' AND s.visit_date IS NOT NULL
     AND ${COMPARABLE_SUBMISSION_SQL}
   GROUP BY month, v.neighbourhood_id
   ORDER BY month
`);

// Same, collapsed across all neighbourhoods — the Munich city-wide line.
const trendsCityWide = db.prepare(`
  SELECT strftime('%Y-%m', s.visit_date) AS month,
         ROUND(AVG(${SUBMISSION_PRICE_500_SQL}), 2) AS avg_price,
         COUNT(*)                        AS n
    FROM submissions s
    JOIN venues v ON v.id = s.venue_id
   WHERE s.status = 'approved' AND s.visit_date IS NOT NULL
     AND ${COMPARABLE_SUBMISSION_SQL}
   GROUP BY month
   ORDER BY month
`);

// The "By Brand" trend view's fixed 10 brands + colour order (a deliberate,
// fixed categorical order — never a dynamically-computed "most common right
// now" ranking, same reasoning as NEIGHBOURHOOD_COLORS on the frontend: a
// line's identity/colour must never shift just because a filter or a new
// submission changed the ranking). Every other brand collapses into 'others'.
const TREND_BRANDS = [
  'Augustiner', 'Paulaner', 'Hofbräu München', 'Hacker-Pschorr', 'Löwenbräu',
  'Spaten', 'Tegernseer', 'Weihenstephaner', 'Giesinger Bräu', 'Ayinger',
];
function brandBucketSql(column) {
  const whens = TREND_BRANDS
    .map((b) => `WHEN ${column} = '${b.replace(/'/g, "''")}' THEN '${b.replace(/'/g, "''")}'`)
    .join(' ');
  return `CASE ${whens} ELSE 'others' END`;
}

const trendsByBrand = db.prepare(`
  SELECT strftime('%Y-%m', s.visit_date) AS month,
         ${brandBucketSql('s.beer_brand')} AS brand,
         ROUND(AVG(${SUBMISSION_PRICE_500_SQL}), 2) AS avg_price,
         COUNT(*)                          AS n
    FROM submissions s
   WHERE s.status = 'approved' AND s.visit_date IS NOT NULL
     AND ${COMPARABLE_SUBMISSION_SQL}
     AND s.beer_brand IS NOT NULL AND s.beer_brand != ''
   GROUP BY month, brand
   ORDER BY month
`);

// "Current average" fallback source for a brand with no submission history
// at all yet — same live beers table the map/stats bar already reads from.
const currentByBrandStmt = db.prepare(`
  SELECT ${brandBucketSql('brand')} AS brand,
         ROUND(AVG(${BEER_PRICE_500_SQL}), 2) AS avg_price
    FROM beers
   WHERE active = 1 AND size_05 > 0 AND serving_volume_ml > 0
   GROUP BY brand
`);

function getTrends() {
  const byHood = trendsByNeighbourhood.all();
  const city = trendsCityWide.all();
  const byBrand = trendsByBrand.all();
  const currentByBrand = Object.fromEntries(currentByBrandStmt.all().map((r) => [r.brand, r.avg_price]));
  // Reuses getNeighbourhoods()'s own live-average calculation rather than a
  // second query — same "current price right now" number the stats bar and
  // map shading already show, so the fallback line can never disagree with
  // the rest of the app about what "the current average" is.
  const currentByNeighbourhood = Object.fromEntries(getNeighbourhoods().map((n) => [n.id, n.avg_price]));

  const months = [...new Set([
    ...byHood.map((r) => r.month), ...city.map((r) => r.month), ...byBrand.map((r) => r.month),
  ])].sort();

  const series = {};
  for (const row of byHood) {
    (series[row.neighbourhood_id] ||= {})[row.month] = { avg: row.avg_price, n: row.n };
  }
  const cityByMonth = {};
  for (const row of city) cityByMonth[row.month] = { avg: row.avg_price, n: row.n };

  const brandSeries = {};
  for (const row of byBrand) {
    (brandSeries[row.brand] ||= {})[row.month] = { avg: row.avg_price, n: row.n };
  }

  return {
    months,
    series,               // { [neighbourhood_id]: { [month]: {avg, n} } }
    city: cityByMonth,    // { [month]: {avg, n} }
    brandSeries,          // { [brandOrBucket]: { [month]: {avg, n} } }
    brandOrder: [...TREND_BRANDS, 'others'],
    currentByNeighbourhood, // { [neighbourhood_id]: avg } — no-history fallback
    currentByBrand,         // { [brandOrBucket]: avg } — no-history fallback
  };
}

// ─── Admin venue/beer management ────────────────────────────────────────────

const insertVenueStmt = db.prepare(`
  INSERT INTO venues
    (id, name, type, neighbourhood_id, address, lat, lng, opening_hours, website,
     description_de, description_en, active)
  VALUES
    (@id, @name, @type, @neighbourhood_id, @address, @lat, @lng, @opening_hours, @website,
     @description_de, @description_en, 1)
`);

// Full-edit — every field the Manage Venues "Edit" form exposes, saved in one go.
const updateVenueStmt = db.prepare(`
  UPDATE venues SET
    name = @name, type = @type, neighbourhood_id = @neighbourhood_id, address = @address,
    lat = @lat, lng = @lng, opening_hours = @opening_hours, website = @website,
    description_de = @description_de, description_en = @description_en, active = @active
  WHERE id = @id
`);
const venueExistsStmt = db.prepare('SELECT 1 FROM venues WHERE id = ?');

// Returns false if the venue doesn't exist.
function updateVenue(id, fields) {
  if (!venueExistsStmt.get(id)) return false;
  updateVenueStmt.run({
    id,
    name: fields.name,
    type: fields.type,
    neighbourhood_id: fields.neighbourhood_id,
    address: fields.address ?? null,
    lat: fields.lat ?? null,
    lng: fields.lng ?? null,
    opening_hours: fields.opening_hours ?? null,
    website: fields.website ?? null,
    description_de: fields.description_de ?? null,
    description_en: fields.description_en ?? null,
    active: fields.active ? 1 : 0,
  });
  return true;
}

const insertBeerStmt = db.prepare(`
  INSERT INTO beers
    (venue_id, brand, size_05, size_mass, updated, reports, active, serve_type,
     serving_volume_ml, price_observed_at, verified_at, source_type)
  VALUES
    (@venue_id, @brand, @size_05, @size_mass, @updated, 1, 1, @serve_type,
     @serving_volume_ml, @price_observed_at, NULL, @source_type)
`);

const insertPriceHistoryStmt = db.prepare(`
  INSERT INTO price_history
    (beer_id, venue_id, brand, price, serving_volume_ml, price_observed_at,
     source_type, changed_by, submission_id, event, created_at)
  VALUES
    (@beer_id, @venue_id, @brand, @price, @serving_volume_ml, @price_observed_at,
     @source_type, @changed_by, @submission_id, @event, @created_at)
`);

// One row per REAL price observation/change — see the price_history comment in
// schema.sql. Callers: an admin entering/changing a price, and an approved
// submission. Never "Verify", never a no-op save, never a rejection.
function recordPriceHistory(entry) {
  insertPriceHistoryStmt.run({
    beer_id: entry.beer_id ?? null,
    venue_id: entry.venue_id,
    brand: entry.brand,
    price: entry.price,
    serving_volume_ml: entry.serving_volume_ml ?? null,
    price_observed_at: toDateOnly(entry.price_observed_at),
    source_type: isValidSourceType(entry.source_type) ? entry.source_type : null,
    changed_by: entry.changed_by ?? null,
    submission_id: entry.submission_id ?? null,
    event: entry.event,
    created_at: new Date().toISOString(),
  });
}

// Bound parameters for insertBeerStmt from a caller's beer object.
//  - serving_volume_ml defaults to 500: every creation path (admin form,
//    new-venue proposal, the research/backfill scripts) collects the "0.5 L
//    price", so 500 is a fact about the input, not a guess. A caller that
//    genuinely doesn't know passes null and the size stays unknown.
//  - price_observed_at defaults to NULL. Only a caller that can vouch for
//    WHEN the price was seen passes one (an approved submission's visit date,
//    or an admin entering a price right now). Scripts that insert researched
//    prices at boot leave it NULL rather than stamping "today" on them.
//  - `updated` is the technical modification date: the date this row was written.
function beerInsertParams(venue_id, b) {
  return {
    venue_id,
    brand: b.brand,
    size_05: b.size_05,
    size_mass: b.size_mass ?? null,
    updated: todayISO(),
    serve_type: normalizeServeType(b.serve_type),
    serving_volume_ml: b.serving_volume_ml === undefined ? REFERENCE_VOLUME_ML : b.serving_volume_ml,
    price_observed_at: toDateOnly(b.price_observed_at),
    // NULL = unknown. Only a caller that knows where the price came from sets it.
    source_type: isValidSourceType(b.source_type) ? b.source_type : null,
  };
}

// Inserts a beer and returns its id. When the caller passes record_history_by
// (an admin adding a price, or an approved new-venue/new-beer submission) the
// creation is also written to price_history; the research/backfill scripts
// don't, so their prices stay history-less rather than getting an invented
// first entry.
function insertBeer(venue_id, b) {
  const params = beerInsertParams(venue_id, b);
  const beerId = Number(insertBeerStmt.run(params).lastInsertRowid);
  if (b.record_history_by) {
    recordPriceHistory({
      beer_id: beerId,
      venue_id,
      brand: b.brand,
      price: b.size_05,
      serving_volume_ml: params.serving_volume_ml,
      price_observed_at: b.price_observed_at,
      source_type: b.source_type,
      changed_by: b.record_history_by,
      submission_id: b.history_submission_id,
      event: b.history_event || 'created',
    });
  }
  return beerId;
}

const beerBelongsToVenueStmt = db.prepare('SELECT id FROM beers WHERE id = ? AND venue_id = ?');
const beerByIdStmt = db.prepare('SELECT * FROM beers WHERE id = ?');
const beerForVenueStmt = db.prepare('SELECT * FROM beers WHERE id = ? AND venue_id = ?');
const activeBeerByBrandStmt = db.prepare(
  'SELECT * FROM beers WHERE venue_id = ? AND brand = ? AND active = 1'
);

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents (ä -> a etc.)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueVenueId(name) {
  const base = slugify(name) || 'venue';
  let id = base;
  let n = 1;
  const exists = db.prepare('SELECT 1 FROM venues WHERE id = ?');
  while (exists.get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  return id;
}

// Creates a venue with one or more beers in a single transaction. `beersInput`
// is [{ brand, size_05, size_mass, serve_type?, serving_volume_ml?,
// price_observed_at? }, ...] — at least one required.
const createVenue = db.transaction((venue, beersInput) => {
  const id = uniqueVenueId(venue.name);

  // Descriptions are never auto-generated — a venue created without one (admin
  // form left blank, or a user-submitted new-venue proposal with no "about
  // this place" text) simply stays empty until a human writes one.
  const description_de = venue.description_de?.trim() || null;
  const description_en = venue.description_en?.trim() || null;

  insertVenueStmt.run({
    id,
    name: venue.name,
    type: venue.type,
    neighbourhood_id: venue.neighbourhood_id,
    address: venue.address || null,
    lat: venue.lat ?? null,
    lng: venue.lng ?? null,
    opening_hours: venue.opening_hours || null,
    website: venue.website || null,
    description_de,
    description_en,
  });

  for (const b of beersInput) {
    insertBeer(id, b);
  }

  return id;
});

function addBeerToVenue(venue_id, beer) {
  return insertBeer(venue_id, beer);
}

// Admin price edit. Returns false if the beer doesn't exist / doesn't belong to
// that venue.
//
//  * A save that changes nothing writes nothing — not even `updated`, and no
//    history entry. (It used to stamp `updated = today` on every save, so
//    clicking Save on an old price made it look freshly confirmed.)
//  * `updated` (technical) moves only when a stored value actually changed.
//  * A changed headline price or serving size is a new observation by the
//    admin: price_observed_at = the date they entered (default: today),
//    verified_at is CLEARED (any earlier verification was of the OLD value),
//    the source becomes 'ADMIN' unless they chose one, and ONE price_history
//    entry is written. Saving NEVER sets verified_at — only the separate
//    "Verify" action does.
//  * price_observed_at given on its own (a date correction, no price change):
//    it is stored as given, and a verification that is not newer than it is
//    cleared so freshness (which prefers verified_at) can't contradict it. No
//    history entry — the price didn't change.
//  * source_type / notes / serve_type / size_mass alone touch `updated` only;
//    they say nothing about how current the headline price is.
//  * serve_type / serving_volume_ml / price_observed_at / source_type / notes
//    are optional — an omitted (undefined) value keeps what the beer already has.
function updateBeerPrice(venue_id, beer_id, fields, ctx = {}) {
  const { size_05, size_mass, serve_type, serving_volume_ml, price_observed_at, source_type, notes } = fields;
  const existing = beerForVenueStmt.get(beer_id, venue_id);
  if (!existing) return false;

  const nextServe = serve_type !== undefined ? normalizeServeType(serve_type) : existing.serve_type;
  const nextVolume = serving_volume_ml !== undefined ? serving_volume_ml : existing.serving_volume_ml;
  const nextMass = size_mass ?? null;
  const nextNotes = notes !== undefined ? (String(notes ?? '').trim() || null) : existing.notes;
  const givenObserved = toDateOnly(price_observed_at);

  const headlineChanged = existing.size_05 !== size_05
    || (existing.serving_volume_ml ?? null) !== (nextVolume ?? null);
  const massChanged = (existing.size_mass ?? null) !== nextMass;
  const serveChanged = existing.serve_type !== nextServe;
  const notesChanged = (existing.notes ?? null) !== (nextNotes ?? null);

  let nextSource = source_type !== undefined ? (isValidSourceType(source_type) ? source_type : null) : existing.source_type;
  let observed = existing.price_observed_at;
  let verified = existing.verified_at;
  let observedChanged = false;

  if (headlineChanged) {
    observed = givenObserved || todayISO();
    verified = null;
    if (source_type === undefined) nextSource = 'ADMIN'; // the admin entered this price
  } else if (givenObserved && givenObserved !== existing.price_observed_at) {
    observed = givenObserved;
    observedChanged = true;
    if (verified && verified <= observed) verified = null;
  }
  const sourceChanged = (existing.source_type ?? null) !== (nextSource ?? null);

  if (!headlineChanged && !massChanged && !serveChanged && !notesChanged && !observedChanged && !sourceChanged) {
    return true;
  }

  db.prepare(`
    UPDATE beers
       SET size_05 = @size_05, size_mass = @size_mass, serve_type = @serve_type,
           serving_volume_ml = @serving_volume_ml, updated = @today,
           price_observed_at = @price_observed_at, verified_at = @verified_at,
           source_type = @source_type, notes = @notes
     WHERE id = @beer_id AND venue_id = @venue_id
  `).run({
    beer_id, venue_id, today: todayISO(),
    size_05, size_mass: nextMass, serve_type: nextServe, serving_volume_ml: nextVolume ?? null,
    price_observed_at: observed, verified_at: verified,
    source_type: nextSource ?? null, notes: nextNotes ?? null,
  });

  if (headlineChanged) {
    recordPriceHistory({
      beer_id, venue_id, brand: existing.brand, price: size_05, serving_volume_ml: nextVolume ?? null,
      price_observed_at: observed, source_type: nextSource, changed_by: ctx.changedBy || 'admin',
      event: 'price_changed',
    });
  }
  return true;
}

// "This price is still correct." Sets verified_at = today and NOTHING else:
// the price, its observation date and the technical `updated` are untouched,
// and no history/log-of-a-price-change is implied — confirming an unchanged
// price is not a price change. Returns 'not_found' | 'no_price' | { ... }.
function verifyBeerPrice(venue_id, beer_id) {
  const existing = beerForVenueStmt.get(beer_id, venue_id);
  if (!existing) return 'not_found';
  if (!(existing.size_05 > 0)) return 'no_price'; // nothing to confirm
  const verified_at = todayISO();
  db.prepare('UPDATE beers SET verified_at = ? WHERE id = ? AND venue_id = ?').run(verified_at, beer_id, venue_id);
  return { brand: existing.brand, price: existing.size_05, verified_at, previous_verified_at: existing.verified_at };
}

// Marks every not-yet-verified price as verified today, in ONE transaction.
// Deliberately the same narrow write as verifyBeerPrice — only `verified_at`;
// no price, `updated`, `price_observed_at` or history entry changes — applied
// to rows where verified_at IS NULL. Scope is limited to beers that actually
// carry a price (size_05 > 0, the same rule the single Verify uses) on venues
// that are live: confirming an empty price or a hidden venue's price would be
// a verification of nothing. Returns { count, verified_at }.
const BULK_VERIFY_SCOPE_SQL = `verified_at IS NULL AND size_05 > 0 AND active = 1
      AND venue_id IN (SELECT id FROM venues WHERE active = 1)`;
const bulkVerifyStmt = db.prepare(`UPDATE beers SET verified_at = @verified_at WHERE ${BULK_VERIFY_SCOPE_SQL}`);
const countUnverifiedStmt = db.prepare(`SELECT COUNT(*) AS n FROM beers WHERE ${BULK_VERIFY_SCOPE_SQL}`);
// How many prices a bulk verify would mark right now (same scope as the write).
function countUnverifiedPrices() {
  return countUnverifiedStmt.get().n;
}
const bulkVerifyPrices = db.transaction(() => {
  const verified_at = todayISO();
  const { changes } = bulkVerifyStmt.run({ verified_at });
  return { count: changes, verified_at };
});

// Deletes the fabricated "seeded price-trend history" submissions that
// early seed.js versions wrote (see SEEDED_ESTIMATE_NOTE). They were invented
// estimates — never a customer report — and feed the public Price Trends chart.
// Matches on the note (the only marker: `submissions` has no source_type
// column). Idempotent; writes a consistent backup first when it will delete
// something. Returns { deleted, ids, backup }.
function removeSeededSubmissions() {
  const rows = db.prepare(`SELECT id FROM submissions WHERE note LIKE ?`).all(`%${SEEDED_ESTIMATE_NOTE}%`);
  if (rows.length === 0) return { deleted: 0, ids: [], backup: null };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${DB_PATH}.pre-remove-seeded-submissions-${stamp}.bak`;
  db.prepare('VACUUM INTO ?').run(backup); // throws on failure -> nothing is deleted
  const del = db.prepare('DELETE FROM submissions WHERE id = ?');
  db.transaction(() => { for (const { id } of rows) del.run(id); })();
  return { deleted: rows.length, ids: rows.map((r) => r.id), backup };
}

// Applies an approved price_change / new_beer submission to the beers table.
// Returns { applied: false, reason } — writing NOTHING, not even `reports` or
// `updated` — when the submission's size isn't a recognised one or its price
// isn't usable; otherwise { applied: true, created, old: {...}, target }.
//
// A price can only be applied for a KNOWN serving size, because the size is
// what makes the number mean anything:
//  * A 1 L (Maß) price for a beer whose headline is not itself the 1 L price
//    goes to size_mass and leaves the headline's dates alone — seeing the
//    Maß price says nothing about the 0.5 L price's age.
//  * Anything else becomes the beer's headline price at that serving size,
//    with price_observed_at = the submission's visit date (resolved by
//    resolveObservationDates: a changed value clears any earlier
//    verification). A different serving size replaces the headline — the row
//    holds one headline price — and the previous price/size is returned so the
//    caller can put it in the audit log; a displaced 1 L headline price is
//    kept in size_mass rather than lost.
//  * An unknown beer is created. Its price is stored as reported, at the
//    reported size — never converted to "0.5 L" and stored as if observed
//    (a 1 L price used to be halved into size_05 as an invented 0.5 L price).
const applyApprovedPrice = db.transaction((sub) => {
  const volume = volumeFromSize(sub.size);
  if (volume === null) return { applied: false, reason: 'invalid_size' };
  if (!(Number(sub.price) > 0)) return { applied: false, reason: 'invalid_price' };

  const price = Number(sub.price);
  const observedAt = toDateOnly(sub.visit_date); // null if the stored value is unusable — never invented
  const today = todayISO();
  const serveType = sub.serve_type || null;
  const existing = activeBeerByBrandStmt.get(sub.venue_id, sub.beer_brand);

  const submitter = sub.submitter_name || 'Anonym';
  // Every applied approval is a real observation, so it gets ONE history entry
  // (source COMMUNITY, attributed to the submitter, dated by the visit date).
  const logObservation = (beerId) => recordPriceHistory({
    beer_id: beerId, venue_id: sub.venue_id, brand: sub.beer_brand, price,
    serving_volume_ml: volume, price_observed_at: observedAt, source_type: 'COMMUNITY',
    changed_by: submitter, submission_id: sub.id, event: 'approved_submission',
  });

  if (!existing) {
    const beerId = insertBeer(sub.venue_id, {
      brand: sub.beer_brand, size_05: price, size_mass: null, serve_type: serveType,
      serving_volume_ml: volume, price_observed_at: observedAt, source_type: 'COMMUNITY',
      record_history_by: submitter, history_submission_id: sub.id, history_event: 'approved_submission',
    });
    return { applied: true, created: true, target: 'headline', old: null, beer_id: beerId };
  }

  const old = { size_05: existing.size_05, size_mass: existing.size_mass, serving_volume_ml: existing.serving_volume_ml };

  if (volume === 1000 && existing.serving_volume_ml !== 1000) {
    db.prepare(`
      UPDATE beers SET size_mass = @price, updated = @today, reports = reports + 1,
             serve_type = COALESCE(@serve_type, serve_type)
       WHERE id = @id
    `).run({ id: existing.id, price, today, serve_type: serveType });
    logObservation(existing.id);
    return { applied: true, created: false, target: 'mass', old, beer_id: existing.id };
  }

  const dates = resolveObservationDates({ existing, newPrice: price, newVolume: volume, observedAt });
  const keepDisplacedMass = existing.serving_volume_ml === 1000 && volume !== 1000 && existing.size_mass == null
    ? existing.size_05
    : existing.size_mass;
  db.prepare(`
    UPDATE beers
       SET size_05 = @price, serving_volume_ml = @volume, size_mass = @size_mass,
           price_observed_at = @price_observed_at, verified_at = @verified_at,
           updated = @today, reports = reports + 1, source_type = 'COMMUNITY',
           serve_type = COALESCE(@serve_type, serve_type)
     WHERE id = @id
  `).run({
    id: existing.id, price, volume, size_mass: keepDisplacedMass ?? null,
    price_observed_at: dates.price_observed_at, verified_at: dates.verified_at,
    today, serve_type: serveType,
  });
  logObservation(existing.id);
  return { applied: true, created: false, target: 'headline', old, beer_id: existing.id };
});

// ─── Price history viewer (admin) ───────────────────────────────────────────

// The note the seed script's fabricated trend-history submissions carry. They
// are formula output, not observations — the history viewer labels them as
// "seeded estimates" so nobody mistakes them for a real price.
const SEEDED_ESTIMATE_NOTE = 'seeded price-trend history';

const priceHistoryRowsStmt = db.prepare(
  'SELECT * FROM price_history WHERE venue_id = ? AND lower(brand) = lower(?) ORDER BY id DESC'
);
// Submissions for the same venue+brand that price_history does NOT already
// represent: pending and rejected ones (never applied, so never recorded), and
// approved ones from before price_history existed. Applied approvals since
// Phase 2 are in price_history (linked by submission_id) and excluded here so
// nothing shows twice.
const submissionHistoryStmt = db.prepare(`
  SELECT * FROM submissions
   WHERE venue_id = ? AND lower(beer_brand) = lower(?) AND price IS NOT NULL
     AND id NOT IN (SELECT submission_id FROM price_history WHERE submission_id IS NOT NULL)
   ORDER BY created_at DESC
`);

// Full price history of one beer for the admin editor: real observations and
// price changes (price_history), plus the submissions described above. Returns
// null if the beer doesn't belong to the venue. `kind` separates a real
// observation from a seeded estimate; `is_current` marks the entry that IS the
// beer's current price — the only one the beer's verified_at can speak for
// (a verification isn't a price event, so it never appears as its own row).
function getBeerHistory(venue_id, beer_id) {
  const beer = beerForVenueStmt.get(beer_id, venue_id);
  if (!beer) return null;

  const entries = [];
  for (const h of priceHistoryRowsStmt.all(venue_id, beer.brand)) {
    entries.push({
      id: `h${h.id}`, kind: 'observation', event: h.event,
      date: h.price_observed_at || h.created_at.slice(0, 10), date_is_observed: h.price_observed_at != null,
      price: h.price, serving_volume_ml: h.serving_volume_ml,
      normalized_500ml_price: normalizePrice(h.price, h.serving_volume_ml),
      source_type: h.source_type, submitted_by: h.changed_by, status: 'approved',
      created_at: h.created_at, verified_at: null, is_current: false,
    });
  }
  for (const sub of submissionHistoryStmt.all(venue_id, beer.brand)) {
    const volume = volumeFromSize(sub.size);
    const seeded = sub.note === SEEDED_ESTIMATE_NOTE;
    entries.push({
      id: `s${sub.id}`, kind: seeded ? 'seeded_estimate' : 'observation', event: 'submission',
      date: sub.visit_date || String(sub.created_at).slice(0, 10), date_is_observed: sub.visit_date != null,
      price: sub.price, serving_volume_ml: volume, normalized_500ml_price: normalizePrice(sub.price, volume),
      source_type: seeded ? null : 'COMMUNITY', submitted_by: seeded ? null : sub.submitter_name,
      status: sub.status, created_at: sub.created_at, verified_at: null, is_current: false,
      // An approved report whose serving size wasn't a recognised one was never
      // applied to the price (see applyApprovedPrice) — say so, rather than
      // letting "approved" read as "this is a price we recorded".
      not_applied: sub.status === 'approved' && volume === null,
    });
  }
  entries.sort((a, b) => (b.date.localeCompare(a.date)) || String(b.created_at).localeCompare(String(a.created_at)));

  const current = entries.find((e) => e.kind === 'observation' && e.status === 'approved'
    && e.price === beer.size_05 && (e.serving_volume_ml ?? null) === (beer.serving_volume_ml ?? null));
  if (current) {
    current.is_current = true;
    current.verified_at = beer.verified_at;
  }
  return {
    beer: {
      id: beer.id, brand: beer.brand, size_05: beer.size_05, serving_volume_ml: beer.serving_volume_ml,
      price_observed_at: beer.price_observed_at, verified_at: beer.verified_at, source_type: beer.source_type,
    },
    entries,
  };
}

// ─── Data-quality flags (admin) ─────────────────────────────────────────────

// Flags currently hidden by "Dismiss" (a Set of flagKey()s). Expired
// dismissals are simply ignored — and pruned here — so the flag reappears by
// itself once its 7 days are up.
function getActiveDismissalKeys(now = new Date()) {
  const nowIso = now.toISOString();
  db.prepare('DELETE FROM flag_dismissals WHERE dismissed_until <= ?').run(nowIso);
  return new Set(
    db.prepare('SELECT flag, venue_id, beer_id FROM flag_dismissals WHERE dismissed_until > ?')
      .all(nowIso).map((r) => flagKey(r.flag, r.venue_id, r.beer_id)),
  );
}

// Hides one flag for THRESHOLDS.DISMISS_DAYS days. Fixes and deletes nothing.
// Returns the ISO time it reappears.
function dismissFlag({ flag, venue_id, beer_id = 0, by = 'admin' }, now = new Date()) {
  const until = new Date(now.getTime() + THRESHOLDS.DISMISS_DAYS * 86400000).toISOString();
  db.prepare(`
    INSERT INTO flag_dismissals (flag, venue_id, beer_id, dismissed_until, dismissed_by, created_at)
    VALUES (@flag, @venue_id, @beer_id, @until, @by, @created_at)
    ON CONFLICT(flag, venue_id, beer_id) DO UPDATE SET
      dismissed_until = excluded.dismissed_until, dismissed_by = excluded.dismissed_by, created_at = excluded.created_at
  `).run({ flag, venue_id, beer_id: beer_id || 0, until, by, created_at: now.toISOString() });
  return until;
}

// The admin venues (with admin-only beer fields) plus every open flag over them.
function getDataQuality(now = new Date()) {
  const venues = getVenuesAdmin();
  const dismissed = getActiveDismissalKeys(now);
  return { venues, flags: computeFlags(venues, dismissed), dismissed_count: dismissed.size };
}

// ─── Submission review (admin) ──────────────────────────────────────────────

const OUTLIER_THRESHOLD = 0.25; // >25% off the current price (per 0.5 L) = warning

// A submission row plus everything a reviewer needs to judge it without
// leaving the queue: the submitted price at its serving size and per 0.5 L,
// the venue's CURRENT price for that beer, and how far apart they are. The
// outlier flag is recomputed against the current price now, not the price at
// submission time (which may since have changed). Community submissions all
// come through the public form, so their source is COMMUNITY.
function enrichSubmissionForAdmin(row) {
  const volume = volumeFromSize(row.size);
  const normalized = normalizePrice(row.price, volume);
  let current = null;
  if (row.venue_id && row.beer_brand) {
    const beer = activeBeerByBrandStmt.get(row.venue_id, row.beer_brand);
    if (beer) {
      current = {
        beer_id: beer.id, price: beer.size_05, serving_volume_ml: beer.serving_volume_ml,
        normalized_500ml_price: normalizePrice(beer.size_05, beer.serving_volume_ml),
        freshness_state: getFreshness(beer).state,
        price_observed_at: beer.price_observed_at, verified_at: beer.verified_at,
      };
    }
  }
  let differencePct = null;
  if (normalized != null && current?.normalized_500ml_price) {
    differencePct = Math.round(((normalized - current.normalized_500ml_price) / current.normalized_500ml_price) * 1000) / 10;
  }
  return {
    ...row,
    source_type: 'COMMUNITY',
    serving_volume_ml: volume,
    size_valid: row.price == null ? null : volume !== null,
    normalized_500ml_price: normalized,
    current,
    difference_pct: differencePct,
    outlier: differencePct != null && Math.abs(differencePct) > OUTLIER_THRESHOLD * 100,
  };
}

function getAdminSubmissions(status) {
  const rows = status ? submissionsByStatus.all(status) : allSubmissions.all();
  return rows.map(enrichSubmissionForAdmin);
}

// Raw active-flag flip, independent of the full-edit form — used when
// approving a "closed" report auto-deactivates the venue (MARK_CLOSED).
const setVenueActiveStmt = db.prepare('UPDATE venues SET active = @active WHERE id = @id');
function setVenueActive(id, active) {
  if (!venueExistsStmt.get(id)) return null;
  setVenueActiveStmt.run({ id, active: active ? 1 : 0 });
  return getVenueAdmin(id);
}

// Hard delete. Beers cascade via their FK (ON DELETE CASCADE); a submission
// that references this venue is detached (venue_id -> NULL) rather than
// deleted, so its approved price-history entry isn't wiped along with it —
// and so the FK on submissions.venue_id (no cascade) doesn't reject the delete.
const deleteVenueStmt = db.prepare('DELETE FROM venues WHERE id = ?');
const detachSubmissionsStmt = db.prepare('UPDATE submissions SET venue_id = NULL WHERE venue_id = ?');
const deleteVenueTxn = db.transaction((id) => {
  detachSubmissionsStmt.run(id);
  deleteVenueStmt.run(id);
  // price_history / flag_dismissals carry no foreign key (so a delisted beer's
  // history stays readable) — clean them up explicitly with the venue.
  db.prepare('DELETE FROM price_history WHERE venue_id = ?').run(id);
  db.prepare('DELETE FROM flag_dismissals WHERE venue_id = ?').run(id);
});

// Returns the venue as it was just before deletion (for logging/notifying),
// or null if it didn't exist.
function deleteVenue(id) {
  const venue = getVenueAdmin(id);
  if (!venue) return null;
  deleteVenueTxn(id);
  return venue;
}

const deleteBeerStmt = db.prepare('DELETE FROM beers WHERE id = ? AND venue_id = ?');
const countActiveBeersStmt = db.prepare('SELECT COUNT(*) AS n FROM beers WHERE venue_id = ? AND active = 1');

// Returns 'not_found' | 'last_beer' | 'ok'. A venue must always keep at least
// one beer — deleting the last one would leave it with no price at all.
function deleteBeer(venue_id, beer_id) {
  if (!beerBelongsToVenueStmt.get(beer_id, venue_id)) return 'not_found';
  if (countActiveBeersStmt.get(venue_id).n <= 1) return 'last_beer';
  deleteBeerStmt.run(beer_id, venue_id);
  return 'ok';
}

const countVenues = db.prepare('SELECT COUNT(*) AS n FROM venues');
const countSubmissionsByStatus = db.prepare(
  `SELECT status, COUNT(*) AS n FROM submissions GROUP BY status`
);
const countPendingOutliers = db.prepare(
  `SELECT COUNT(*) AS n FROM submissions WHERE is_outlier = 1 AND status = 'pending'`
);

module.exports = {
  db,
  DB_PATH,
  initSchema,
  isEmpty,
  SERVE_TYPES,
  normalizeServeType,
  getVenues,
  getVenue,
  getVenuesAdmin,
  getVenueAdmin,
  getNeighbourhoods,
  getCities,
  createCity,
  updateCity,
  logAdminAction,
  getAdminLogs,
  getAdminLogsForExport,
  getStats,
  getTrends,
  hydrateVenue,
  createVenue,
  updateVenue,
  setVenueActive,
  deleteVenue,
  addBeerToVenue,
  updateBeerPrice,
  verifyBeerPrice,
  bulkVerifyPrices,
  countUnverifiedPrices,
  removeSeededSubmissions,
  applyApprovedPrice,
  recordPriceHistory,
  getBeerHistory,
  dismissFlag,
  getDataQuality,
  getAdminSubmissions,
  SEEDED_ESTIMATE_NOTE,
  BEER_PRICE_500_SQL,
  SUBMISSION_PRICE_500_SQL,
  getPublicPriceHistory,
  hydrateBeer,
  deleteBeer,
  statements: {
    insertSubmission,
    nextSubmissionSeq,
    submissionsByStatus,
    allSubmissions,
    submissionById,
    setSubmissionStatus,
    setSubmissionVenueId,
    setVenueDescriptionDe,
    countVenues,
    countSubmissionsByStatus,
    countPendingOutliers,
  },
};
