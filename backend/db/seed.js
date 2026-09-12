// Seed script for MünchnerBierpreis v3.
//
//   node backend/db/seed.js            # seed only if the DB is empty
//   node backend/db/seed.js --force    # wipe and re-seed
//
// Venue content and 2025 Helles prices come from seedData.js (the v1 dataset:
// 13 venues across Altstadt, Maxvorstadt, Schwabing, Isarvorstadt).
// The "last confirmed" date on each price is spread across recent months so the
// price-freshness traffic light shows a realistic green / yellow / red mix.

require('dotenv').config();

const { db, initSchema, isEmpty } = require('./database');
const { neighbourhoods, venues } = require('./seedData');

const FORCE = process.argv.includes('--force');

// Days-ago offset per venue index → green (<90) / yellow (90–182) / red (>182).
// Long, varied list so a large venue set still gets a full traffic-light spread.
const FRESHNESS_OFFSETS = [
  8, 18, 27, 34, 42, 51, 60, 69, 78, 86,
  96, 108, 121, 135, 150, 164, 177,
  190, 205, 224, 246, 270, 298, 330, 365, 400, 440,
];

function daysAgoISO(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const insertNeighbourhood = db.prepare(`
  INSERT INTO neighbourhoods
    (id, name_de, name_en, center_lat, center_lng, description_de, description_en)
  VALUES (@id, @name_de, @name_en, @center_lat, @center_lng, @description_de, @description_en)
`);

const insertVenue = db.prepare(`
  INSERT INTO venues
    (id, name, type, neighbourhood_id, address, lat, lng, opening_hours, website,
     description_de, description_en)
  VALUES
    (@id, @name, @type, @neighbourhood_id, @address, @lat, @lng, @opening_hours, @website,
     @description_de, @description_en)
`);

const insertBeer = db.prepare(`
  INSERT INTO beers (venue_id, brand, size_05, size_mass, updated, reports)
  VALUES (@venue_id, @brand, @size_05, @size_mass, @updated, @reports)
`);

const insertHistorySubmission = db.prepare(`
  INSERT INTO submissions
    (id, venue_id, venue_name, is_new_venue, beer_brand, size, price,
     visit_date, submitter_name, note, status, is_outlier, created_at)
  VALUES
    (@id, @venue_id, @venue_name, 0, @beer_brand, '0.5L', @price,
     @visit_date, 'Community', 'seeded price-trend history', 'approved', 0, @created_at)
`);

// Months-ago → the first of that month, as an ISO date string.
function monthsAgoISO(n) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

// Backfill ~9 months of approved price reports so the Price Trends chart has a real
// series to draw per neighbourhood + a city average, instead of one flat point.
// Prices are derived from each venue's current headline price, discounted backwards
// by a modest monthly inflation rate (Munich Helles has been getting steadily
// pricier) plus small per-report noise — not real historical data, but a realistic
// shape consistent with today's actual prices.
const MONTHLY_INFLATION = 0.004; // ~0.4%/month, roughly Munich's recent beer-price drift
const HISTORY_MONTHS = 9;

function seedTrendHistory() {
  let seq = db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n;
  const byHood = {};
  for (const v of venues) {
    (byHood[v.neighbourhood_id] ||= []).push(v);
  }

  for (const [hoodId, hoodVenues] of Object.entries(byHood)) {
    // Trend price is the neighbourhood's blended average, discounted backwards —
    // a single, smooth curve per neighbourhood. Every month's row still has to
    // point at a real venue (FK constraint), so pick one fixed anchor venue to
    // file them under; that doesn't affect the price value used.
    const avgNow = hoodVenues.reduce((s, v) => s + v.beers[0].size_05, 0) / hoodVenues.length;
    const anchor = hoodVenues[0];

    for (let m = HISTORY_MONTHS; m >= 1; m--) {
      const noise = ((m * 37 + hoodId.length * 13) % 9 - 4) / 100; // -0.04..+0.04, deterministic and small
      const price = Math.round((avgNow / Math.pow(1 + MONTHLY_INFLATION, m) + noise) * 20) / 20;

      seq += 1;
      insertHistorySubmission.run({
        id: `h${String(seq).padStart(4, '0')}`,
        venue_id: anchor.id,
        venue_name: anchor.name,
        beer_brand: anchor.beers[0].brand,
        price: Math.max(4.0, price),
        visit_date: monthsAgoISO(m),
        created_at: new Date().toISOString(),
      });
    }
  }
}

const seed = db.transaction(() => {
  db.exec('DELETE FROM beers; DELETE FROM submissions; DELETE FROM venues; DELETE FROM neighbourhoods;');

  for (const n of neighbourhoods) {
    insertNeighbourhood.run({
      id: n.id,
      name_de: n.name_de,
      name_en: n.name_en,
      center_lat: n.center?.[0] ?? null,
      center_lng: n.center?.[1] ?? null,
      description_de: n.description_de ?? null,
      description_en: n.description_en ?? null,
    });
  }

  venues.forEach((v, i) => {
    insertVenue.run({
      id: v.id,
      name: v.name,
      type: v.type,
      neighbourhood_id: v.neighbourhood_id,
      address: v.address ?? null,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      opening_hours: v.opening_hours ?? null,
      website: v.website ?? null,
      description_de: v.description_de ?? null,
      description_en: v.description_en ?? null,
    });

    const offset = FRESHNESS_OFFSETS[i % FRESHNESS_OFFSETS.length];
    v.beers.forEach((b, bi) => {
      insertBeer.run({
        venue_id: v.id,
        brand: b.brand,
        size_05: b.size_05 ?? null,
        size_mass: b.size_mass ?? null,
        // headline beer gets the spread date; extras keep their own or fall back
        updated: bi === 0 ? daysAgoISO(offset) : b.updated ?? daysAgoISO(offset),
        reports: b.reports ?? 1,
      });
    });
  });

  seedTrendHistory();
});

initSchema();

if (!FORCE && !isEmpty()) {
  console.log('🍺 Database already has venues — nothing to do. Use --force to re-seed.');
  process.exit(0);
}

seed();

const counts = {
  neighbourhoods: db.prepare('SELECT COUNT(*) n FROM neighbourhoods').get().n,
  venues: db.prepare('SELECT COUNT(*) n FROM venues').get().n,
  beers: db.prepare('SELECT COUNT(*) n FROM beers').get().n,
  history: db.prepare("SELECT COUNT(*) n FROM submissions WHERE id LIKE 'h%'").get().n,
};

console.log(`🍺 Seeded ${counts.venues} venues, ${counts.beers} beers, ${counts.neighbourhoods} neighbourhoods, ${counts.history} historical price reports.`);
