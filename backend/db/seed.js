// Seed script for Bierpreis v3.
//
//   node backend/db/seed.js            # seed only if the DB is empty
//   node backend/db/seed.js --force    # wipe and re-seed
//
// Venue content and the 2025 Helles prices come from seedData.js (the v1
// dataset).
//
// Prices are estimates — not verified observations.
// Users and admin must verify via the app.
//
// So this script records ONLY what is actually known about each price:
//   * price_observed_at = NULL  (nobody has seen these prices being charged)
//   * verified_at       = NULL  (nobody has confirmed them)
//   * updated           = the date this seed ran (a technical timestamp only)
//   * serving_volume_ml = 500   (size_05 is, by definition, the 0.5 L price)
//   * reports           = 0     (COUNT of real approved `submissions` — none
//                                 exist yet for a freshly seeded price; kept in
//                                 sync by resetReportCounts on every boot)
//   * size_confirmed    = 0     (nobody has confirmed the 500 ml assumption —
//                                 see the size_confirmed migration comment)
// It used to spread each price's "last confirmed" date across the last year
// (so the freshness traffic light would show a realistic green/yellow/red
// mix) and to generate ~9 months of fake approved price submissions from a
// formula (so the Price Trends chart had a line to draw). Both were invented
// data presented as observations; neither exists any more. Seeded prices show
// as "date unknown" until a real observation or verification is recorded, and
// the trend chart stays empty until real approved submissions exist.

require('dotenv').config();

const { db, initSchema, isEmpty } = require('./database');
const { todayISO } = require('../utils/priceUtils');
const { neighbourhoods, venues } = require('./seedData');

const FORCE = process.argv.includes('--force');

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
  INSERT INTO beers
    (venue_id, brand, size_05, size_mass, updated, reports,
     serving_volume_ml, price_observed_at, verified_at, size_confirmed)
  VALUES
    (@venue_id, @brand, @size_05, @size_mass, @updated, 0,
     500, NULL, NULL, 0)
`);

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

  venues.forEach((v) => {
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

    const seededOn = todayISO();
    v.beers.forEach((b) => {
      insertBeer.run({
        venue_id: v.id,
        brand: b.brand,
        size_05: b.size_05 ?? null,
        size_mass: b.size_mass ?? null,
        updated: seededOn,
      });
    });
  });
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
};

console.log(`🍺 Seeded ${counts.venues} venues, ${counts.beers} beers, ${counts.neighbourhoods} neighbourhoods. Prices are unverified estimates (price_observed_at / verified_at are NULL).`);
