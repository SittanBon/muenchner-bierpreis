// One-time production backfill: 18 venues that were researched, geocoded and
// added to the LOCAL dev database back in commit 2496e66 ("feat: 18 new
// venues...", 152 -> 170 venues) via backend/db/addMissingVenues.js, but that
// script was only ever run against local dev — never against production.
// This is the same 18-venue set, carrying over the exact reviewed data
// (address/coordinates/price/brand) from local dev rather than re-deriving
// or re-geocoding it.
//
//   node backend/db/migrate.js     (or: npm run migrate)
//
// Safe to run any number of times, anywhere, including automatically on
// every server boot (see server.js): each venue is looked up by
// case-insensitive name before insert — already-present venues are skipped,
// never re-inserted, never modified. This script only ever INSERTs new
// venues/beers; it never UPDATEs or DELETEs an existing venue, and it never
// touches the submissions or admin_logs tables except to add one ADD_VENUE
// entry per venue it actually inserts (for an honest audit trail — "where
// did 18 venues suddenly come from" should have an answer).
require('dotenv').config();
const { db, getVenuesAdmin, createVenue, logAdminAction } = require('./database');

// Extracted from the local dev DB's actual rows for these 18 venues (i.e.
// post-geocoding, post-review — not re-derived from addMissingVenues.js's
// own NEW_VENUES list, which only has the pre-geocode inputs). One venue's
// beer row (24/7 Bites and Delights) had picked up unrelated test-session
// noise in local dev — reports:2, serve_type:'tap', a stale `updated` date
// from a submit/approve/revert cycle used to verify the admin-flow audit log
// elsewhere this session — normalised back to the original curated values
// (reports:1, serve_type:'unknown', updated:'2026-09-13') below so production
// doesn't inherit that noise.
const MIGRATION_VENUES = [
  { name: 'LUX Bar & Restaurant', type: 'bar', neighbourhood_id: 'altstadt',
    address: 'Ledererstraße 13, 80331 München', lat: 48.1372212, lng: 11.5789551,
    beers: [{ brand: 'Paulaner', size_05: 6.40, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Barele', type: 'bar', neighbourhood_id: 'altstadt',
    address: 'Hochbrückenstraße 4, 80331 München', lat: 48.1364148, lng: 11.5799595,
    beers: [{ brand: 'Augustiner', size_05: 5.60, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Max & Moritz Wine Bar', type: 'bar', neighbourhood_id: 'altstadt',
    address: 'Westenriederstraße 9, 80331 München', lat: 48.1348763, lng: 11.5771587,
    beers: [{ brand: 'Tegernseer', size_05: 6.20, size_mass: null, serve_type: 'unknown' }] },
  { name: 'the High München', type: 'bar', neighbourhood_id: 'altstadt',
    address: 'Blumenstraße 15, 80331 München', lat: 48.1329458, lng: 11.5730867,
    beers: [{ brand: 'Paulaner', size_05: 6.80, size_mass: null, serve_type: 'unknown' }] },
  { name: 'manu. weinbar & restaurant', type: 'restaurant', neighbourhood_id: 'altstadt',
    address: 'Rumfordstraße 1, 80469 München', lat: 48.1333877, lng: 11.5753705,
    beers: [{ brand: 'Andechs', size_05: 6.10, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Gebrüder Keller und Erben', type: 'beer_hall', neighbourhood_id: 'altstadt',
    address: 'Klenzestraße 1, 80469 München', lat: 48.1336064, lng: 11.5795121,
    beers: [{ brand: 'Hofbräu München', size_05: 5.20, size_mass: 10.40, serve_type: 'unknown' }] },
  { name: 'Kulturstrand der urbanauten', type: 'bar', neighbourhood_id: 'altstadt',
    address: 'Corneliusbrücke, 80469 München', lat: 48.1283329, lng: 11.5803979,
    beers: [{ brand: 'Giesinger Bräu', size_05: 5.40, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Dizzy Daisy Weinbar', type: 'bar', neighbourhood_id: 'isarvorstadt',
    address: 'Thalkirchner Straße 10, 80337 München', lat: 48.1320326, lng: 11.5664189,
    beers: [{ brand: 'Tegernseer', size_05: 6.00, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Vertigo', type: 'bar', neighbourhood_id: 'isarvorstadt',
    address: 'Vertigo, 43, Blumenstraße', lat: 48.1321869, lng: 11.5687449,
    beers: [{ brand: 'Spaten', size_05: 5.80, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Weinbar Garbo', type: 'bar', neighbourhood_id: 'isarvorstadt',
    address: 'Weinbar Garbo, Baumstraße, Glockenbach', lat: 48.1261917, lng: 11.5701715,
    beers: [{ brand: 'Camba Bavaria', size_05: 6.30, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Blaue Libelle', type: 'bar', neighbourhood_id: 'isarvorstadt',
    address: 'Hans-Sachs-Straße 3, 80469 München', lat: 48.1304367, lng: 11.5702935,
    beers: [{ brand: 'Augustiner', size_05: 5.50, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Mistinguett', type: 'bar', neighbourhood_id: 'isarvorstadt',
    address: 'Mistinguett, 3a, Ickstattstraße', lat: 48.1288020, lng: 11.5722052,
    beers: [{ brand: 'Paulaner', size_05: 6.60, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Bier Und Wurst', type: 'beer_hall', neighbourhood_id: 'maxvorstadt',
    address: 'Dachauer Straße 7a, 80335 München', lat: 48.1425232, lng: 11.5597792,
    beers: [{ brand: 'Hacker-Pschorr', size_05: 4.90, size_mass: 9.60, serve_type: 'unknown' }] },
  { name: 'Vinothek by Geisel', type: 'bar', neighbourhood_id: 'maxvorstadt',
    address: 'Schützenstraße 11, 80335 München', lat: 48.1397468, lng: 11.5621672,
    beers: [{ brand: 'Tegernseer', size_05: 6.50, size_mass: null, serve_type: 'unknown' }] },
  { name: "L'Oca Bianca", type: 'restaurant', neighbourhood_id: 'maxvorstadt',
    address: 'Alter Messeplatz 6, 80339 München', lat: 48.1347152, lng: 11.5459186,
    beers: [{ brand: 'Paulaner', size_05: 5.90, size_mass: null, serve_type: 'unknown' }] },
  { name: '24/7 Bites and Delights', type: 'restaurant', neighbourhood_id: 'maxvorstadt',
    address: 'Amalienstraße 57, 80799 München', lat: 48.1498236, lng: 11.5778794,
    beers: [{ brand: 'Erdinger', size_05: 5.30, size_mass: null, serve_type: 'unknown' }] },
  { name: 'Bā Mirano', type: 'bar', neighbourhood_id: 'schwabing',
    address: 'Wilhelmstraße 27, 80801 München', lat: 48.1612713, lng: 11.5832007,
    beers: [{ brand: 'Spaten', size_05: 6.40, size_mass: null, serve_type: 'unknown' }] },
  { name: 'nineOfive', type: 'bar', neighbourhood_id: 'schwabing',
    address: 'Pizza Studio, 29, Herzogstraße', lat: 48.1625294, lng: 11.5808752,
    beers: [{ brand: 'Augustiner', size_05: 6.20, size_mass: null, serve_type: 'unknown' }] },
];

function norm(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents (ä -> a etc.)
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function runMigration() {
  // getVenuesAdmin() includes inactive venues too, so a venue an admin has
  // since closed still correctly counts as "already exists" — this must
  // never create a duplicate of something a human deliberately deactivated.
  const existingNames = new Set(getVenuesAdmin().map((v) => norm(v.name)));

  let added = 0;
  let skipped = 0;
  console.log(`🍺 Migration: checking ${MIGRATION_VENUES.length} venues against ${existingNames.size} already in the database...`);

  for (const venue of MIGRATION_VENUES) {
    if (existingNames.has(norm(venue.name))) {
      console.log(`   ⏭️  SKIP — already exists: ${venue.name}`);
      skipped += 1;
      continue;
    }

    const { beers, ...venueFields } = venue;
    const id = createVenue(venueFields, beers);
    logAdminAction('ADD_VENUE', {
      venueId: id,
      venueName: venue.name,
      details: { name: venue.name, neighbourhood: venue.neighbourhood_id, type: venue.type, source: 'migrate.js backfill' },
    });
    console.log(`   ✅ ADDED — ${venue.name} (${venue.neighbourhood_id}, ${venue.type}) -> id ${id}`);
    added += 1;
    // Keep the in-memory set current in case MIGRATION_VENUES ever contains
    // two venues with the same name — the second must be treated as a
    // duplicate of the first, not inserted again.
    existingNames.add(norm(venue.name));
  }

  console.log(`🍺 Migration complete: ${added} added, ${skipped} skipped (already present). Total venues now: ${db.prepare('SELECT COUNT(*) AS n FROM venues').get().n}.`);
  return { added, skipped };
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, MIGRATION_VENUES };
