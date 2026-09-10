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

console.log(`🍺 Seeded ${counts.venues} venues, ${counts.beers} beers, ${counts.neighbourhoods} neighbourhoods.`);
