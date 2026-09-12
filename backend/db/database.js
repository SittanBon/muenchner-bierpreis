// SQLite data layer for Bierpreis v3.
// Opens a single better-sqlite3 connection, applies the schema, and exposes
// query helpers that return the exact JSON shapes the frontend expects.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_PATH = path.join(__dirname, 'bierpreis.db');
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : DEFAULT_PATH;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  migrate();
}

// CREATE TABLE IF NOT EXISTS leaves an already-existing `beers` table without new
// columns added to schema.sql later — add them by hand, guarded so this is safe
// to run on every boot.
function migrate() {
  const beerCols = db.prepare('PRAGMA table_info(beers)').all().map((c) => c.name);
  if (!beerCols.includes('active')) {
    db.exec('ALTER TABLE beers ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
  const venueCols = db.prepare('PRAGMA table_info(venues)').all().map((c) => c.name);
  if (!venueCols.includes('active')) {
    db.exec('ALTER TABLE venues ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
  // city_id scopes a neighbourhood to one of the `cities` rows. DEFAULT 1
  // backfills every pre-existing neighbourhood to Munich in the same statement.
  const neighbourhoodCols = db.prepare('PRAGMA table_info(neighbourhoods)').all().map((c) => c.name);
  if (!neighbourhoodCols.includes('city_id')) {
    db.exec('ALTER TABLE neighbourhoods ADD COLUMN city_id INTEGER DEFAULT 1');
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

// Cheapest active beer first — every consumer that reads beers[0] as "the
// headline price" (stats, map shading, sidebar cards, venue detail) gets the
// cheapest brand for free, with no special-casing needed at the call site.
const beersForVenue = db.prepare(
  `SELECT id, venue_id, brand, size_05, size_mass, updated, reports
     FROM beers WHERE venue_id = ? AND active = 1 ORDER BY size_05 ASC`
);

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

function hydrateVenue(row) {
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
    beers: beersForVenue.all(row.id),
  };
}

function getVenues() {
  return allVenuesStmt.all().map(hydrateVenue);
}

function getVenue(id) {
  return hydrateVenue(venueByIdStmt.get(id));
}

function getVenuesAdmin() {
  return allVenuesAdminStmt.all().map(hydrateVenue);
}

function getVenueAdmin(id) {
  return hydrateVenue(venueByIdAdminStmt.get(id));
}

const neighbourhoodsStmt = db.prepare('SELECT * FROM neighbourhoods ORDER BY name_de');

// Neighbourhoods enriched with the average headline (0.5 L) price + venue count.
function getNeighbourhoods() {
  const venues = getVenues();
  return neighbourhoodsStmt.all().map((n) => {
    const prices = venues
      .filter((v) => v.neighbourhood_id === n.id && v.beers[0]?.size_05 != null)
      .map((v) => v.beers[0].size_05);
    const avg = prices.length
      ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
      : null;
    return {
      id: n.id,
      name_de: n.name_de,
      name_en: n.name_en,
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

// City-wide stats for the public stats bar.
function getStats() {
  const venues = getVenues().filter((v) => v.beers[0]?.size_05 != null);
  const priced = venues.map((v) => ({
    id: v.id,
    name: v.name,
    neighbourhood_id: v.neighbourhood_id,
    price: v.beers[0].size_05,
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
     venue_type, neighbourhood_id, address, lat, lng, size_mass, photo_path)
  VALUES
    (@id, @report_type, @venue_id, @venue_name, @is_new_venue, @beer_brand, @size, @price,
     @visit_date, @submitter_name, @note, @status, @is_outlier, @created_at,
     @venue_type, @neighbourhood_id, @address, @lat, @lng, @size_mass, @photo_path)
`);

const nextSubmissionSeq = db.prepare(
  `SELECT COUNT(*) AS n FROM submissions`
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
const approvedHistoryForVenue = db.prepare(`
  SELECT * FROM submissions
   WHERE venue_id = ? AND status = 'approved'
     AND beer_brand IS NOT NULL AND price IS NOT NULL
   ORDER BY visit_date DESC
`);

// Rolls an approved submission's price into THAT SPECIFIC BRAND's row — a venue
// can list several beers, so this must never just grab "the first beer by id".
const updateHeadlinePrice = db.prepare(`
  UPDATE beers
     SET size_05    = CASE WHEN @size = '0.5L' THEN @price ELSE size_05 END,
         size_mass  = CASE WHEN @size = '1L'   THEN @price ELSE size_mass END,
         updated    = @visit_date,
         reports    = reports + 1
   WHERE venue_id = @venue_id AND brand = @brand AND active = 1
`);

// Monthly average Helles price per neighbourhood, from approved submissions —
// powers the Price Trends chart. Each row is one (month, neighbourhood) average.
// Grouped by v.neighbourhood_id explicitly — submissions now has its own
// neighbourhood_id too (for new_venue proposals), so the bare column name is
// ambiguous once both tables are joined.
const trendsByNeighbourhood = db.prepare(`
  SELECT strftime('%Y-%m', s.visit_date) AS month,
         v.neighbourhood_id            AS neighbourhood_id,
         ROUND(AVG(s.price), 2)        AS avg_price
    FROM submissions s
    JOIN venues v ON v.id = s.venue_id
   WHERE s.status = 'approved' AND s.visit_date IS NOT NULL
   GROUP BY month, v.neighbourhood_id
   ORDER BY month
`);

// Same, collapsed across all neighbourhoods — the Munich city-wide line.
const trendsCityWide = db.prepare(`
  SELECT strftime('%Y-%m', s.visit_date) AS month,
         ROUND(AVG(s.price), 2)          AS avg_price
    FROM submissions s
    JOIN venues v ON v.id = s.venue_id
   WHERE s.status = 'approved' AND s.visit_date IS NOT NULL
   GROUP BY month
   ORDER BY month
`);

function getTrends() {
  const byHood = trendsByNeighbourhood.all();
  const city = trendsCityWide.all();

  const months = [...new Set([...byHood.map((r) => r.month), ...city.map((r) => r.month)])].sort();
  const series = {};
  for (const row of byHood) {
    (series[row.neighbourhood_id] ||= {})[row.month] = row.avg_price;
  }
  const cityByMonth = Object.fromEntries(city.map((r) => [r.month, r.avg_price]));

  return {
    months,
    series,      // { [neighbourhood_id]: { [month]: avg_price } }
    city: cityByMonth, // { [month]: avg_price }
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
  INSERT INTO beers (venue_id, brand, size_05, size_mass, updated, reports, active)
  VALUES (@venue_id, @brand, @size_05, @size_mass, @updated, 1, 1)
`);

const updateBeerPriceStmt = db.prepare(`
  UPDATE beers SET size_05 = @size_05, size_mass = @size_mass, updated = @updated
   WHERE id = @beer_id AND venue_id = @venue_id
`);

const beerBelongsToVenueStmt = db.prepare('SELECT id FROM beers WHERE id = ? AND venue_id = ?');

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
// is [{ brand, size_05, size_mass }, ...] — at least one required.
const createVenue = db.transaction((venue, beersInput) => {
  const id = uniqueVenueId(venue.name);
  const today = new Date().toISOString().slice(0, 10);

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
    description_de: venue.description_de || null,
    description_en: venue.description_en || null,
  });

  for (const b of beersInput) {
    insertBeerStmt.run({
      venue_id: id,
      brand: b.brand,
      size_05: b.size_05,
      size_mass: b.size_mass ?? null,
      updated: today,
    });
  }

  return id;
});

function addBeerToVenue(venue_id, beer) {
  const today = new Date().toISOString().slice(0, 10);
  insertBeerStmt.run({
    venue_id,
    brand: beer.brand,
    size_05: beer.size_05,
    size_mass: beer.size_mass ?? null,
    updated: today,
  });
}

// Returns false if the beer doesn't exist / doesn't belong to that venue.
function updateBeerPrice(venue_id, beer_id, { size_05, size_mass }) {
  if (!beerBelongsToVenueStmt.get(beer_id, venue_id)) return false;
  const today = new Date().toISOString().slice(0, 10);
  updateBeerPriceStmt.run({ beer_id, venue_id, size_05, size_mass: size_mass ?? null, updated: today });
  return true;
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
  hydrateVenue,
  createVenue,
  updateVenue,
  addBeerToVenue,
  updateBeerPrice,
  deleteBeer,
  statements: {
    insertSubmission,
    nextSubmissionSeq,
    submissionsByStatus,
    allSubmissions,
    submissionById,
    setSubmissionStatus,
    setSubmissionVenueId,
    approvedHistoryForVenue,
    updateHeadlinePrice,
    countVenues,
    countSubmissionsByStatus,
    countPendingOutliers,
  },
};
