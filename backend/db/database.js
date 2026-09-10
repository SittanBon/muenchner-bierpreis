// SQLite data layer for MünchnerBierpreis v3.
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
}

// Ensure tables exist before any prepared statement below is compiled.
initSchema();

function isEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM venues').get().n === 0;
}

// ─── Read helpers ────────────────────────────────────────────────────────────

const beersForVenue = db.prepare(
  `SELECT brand, size_05, size_mass, updated, reports
     FROM beers WHERE venue_id = ? ORDER BY id`
);

const venueBase = `
  SELECT v.*,
         n.name_de AS neighbourhood_name_de,
         n.name_en AS neighbourhood_name_en
    FROM venues v
    JOIN neighbourhoods n ON n.id = v.neighbourhood_id
`;

const allVenuesStmt = db.prepare(`${venueBase} ORDER BY v.name`);
const venueByIdStmt = db.prepare(`${venueBase} WHERE v.id = ?`);

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
    beers: beersForVenue.all(row.id),
  };
}

function getVenues() {
  return allVenuesStmt.all().map(hydrateVenue);
}

function getVenue(id) {
  return hydrateVenue(venueByIdStmt.get(id));
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
    (id, venue_id, venue_name, is_new_venue, beer_brand, size, price,
     visit_date, submitter_name, note, status, is_outlier, created_at)
  VALUES
    (@id, @venue_id, @venue_name, @is_new_venue, @beer_brand, @size, @price,
     @visit_date, @submitter_name, @note, @status, @is_outlier, @created_at)
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
  `UPDATE submissions SET status = ? WHERE id = ?`
);
const approvedHistoryForVenue = db.prepare(`
  SELECT * FROM submissions
   WHERE venue_id = ? AND status = 'approved'
   ORDER BY visit_date DESC
`);

const updateHeadlinePrice = db.prepare(`
  UPDATE beers
     SET size_05    = CASE WHEN @size = '0.5L' THEN @price ELSE size_05 END,
         size_mass  = CASE WHEN @size = '1L'   THEN @price ELSE size_mass END,
         updated    = @visit_date,
         reports    = reports + 1
   WHERE id = (SELECT id FROM beers WHERE venue_id = @venue_id ORDER BY id LIMIT 1)
`);

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
  getNeighbourhoods,
  getStats,
  hydrateVenue,
  statements: {
    insertSubmission,
    nextSubmissionSeq,
    submissionsByStatus,
    allSubmissions,
    submissionById,
    setSubmissionStatus,
    approvedHistoryForVenue,
    updateHeadlinePrice,
    countVenues,
    countSubmissionsByStatus,
    countPendingOutliers,
  },
};
