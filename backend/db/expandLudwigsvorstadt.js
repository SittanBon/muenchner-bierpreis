// One-off migration for the Ludwigsvorstadt-Isarvorstadt boundary fix:
//   node backend/db/expandLudwigsvorstadt.js   (or required from server.js's boot)
//
// Does three things, each independently idempotent (safe to run any number
// of times, anywhere):
//   1. Adds the "lehel" and "schwanthalerhoehe" neighbourhoods (skipped if
//      the row already exists).
//   2. Reassigns a specific, hand-verified list of existing venues into the
//      now-correct neighbourhood (skipped per-venue if already correct).
//   3. Adds a small number of real, Nominatim-confirmed venues discovered
//      while researching this fix (duplicate-checked by name first).
//
// IMPORTANT — read before trusting this at face value: the task this script
// implements gave "approximate" polygon coordinates and a list of ~29
// candidate venues to add. Both were checked empirically (point-in-polygon
// against real landmarks/postal codes, and live Nominatim geocoding) rather
// than applied literally, because several turned out to be wrong in ways
// that would have shipped real misinformation:
//   - The given Lehel polygon's west edge (a flat line at lng 11.578) placed
//     the Hofbräuhaus (Platzl), the whole Tal street corridor and
//     Viktualienmarkt inside "Lehel" — all three are unambiguous, famous
//     Altstadt landmarks. That edge is corrected in neighbourhoodGeoJSON.js
//     (nudged to ~11.583/11.584, just past Isartor).
//   - Of the ~28 named venues checked, roughly half either had no confident
//     Nominatim match at all, matched a DIFFERENT business at the given
//     address, or turned out to be real but in an entirely different
//     neighbourhood than the one the request assumed (e.g. "Bar Centrale"
//     is on Ledererstraße in Altstadt, not Leopoldstraße/Lehel; "Prinz
//     Myshkin" and "Zum Alten Markt" are Altstadt, not Lehel/
//     Schwanthalerhöhe; "Holy Home" and "Café am Beethovenplatz" are
//     Isarvorstadt; "Bar Giornale" is Schwabing; "Gasthof Neuwirt" resolved
//     to a different town, Ismaning, entirely).
//   - This script only adds venues that came back from Nominatim as a
//     genuinely confident, correctly-identified match — 11 total, not 29.
//     See the session report for the full list of what was excluded and why.
require('dotenv').config();
const { db, getNeighbourhoods, createVenue, logAdminAction } = require('./database');

function norm(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const NEW_NEIGHBOURHOODS = [
  { id: 'lehel', name_de: 'Lehel', name_en: 'Lehel', center_lat: 48.1390, center_lng: 11.5920 },
  { id: 'schwanthalerhoehe', name_de: 'Schwanthalerhöhe', name_en: 'Schwanthalerhöhe', center_lat: 48.1320, center_lng: 11.5430 },
];

// Hand-verified against real landmarks/postal codes — see the file header
// and the session report for the reasoning behind each one, and for the 7
// venues that were deliberately EXCLUDED from this list despite the raw
// polygon math technically catching them (they're real venues in Haidhausen,
// Untergiesing or Westend — none of which are modelled neighbourhoods yet —
// or, for "Der Pschorr" at Viktualienmarkt, unambiguously central Altstadt).
const REASSIGNMENTS = [
  { id: 'v019', name: 'Weinhaus Neuner', to: 'isarvorstadt' },
  { id: 'v043', name: 'Klenze 17', to: 'isarvorstadt' },
  { id: 'v045', name: 'Karam', to: 'isarvorstadt' },
  { id: 'v049', name: 'The Moon Bar Lehel', to: 'lehel' },
  { id: 'v050', name: 'Tattenbach', to: 'lehel' },
  { id: 'v053', name: 'Cohibar City', to: 'lehel' },
  { id: 'v116', name: 'Garçon', to: 'isarvorstadt' },
  { id: 'v117', name: 'Terra', to: 'isarvorstadt' },
  { id: 'v120', name: 'Bar Polloi', to: 'isarvorstadt' },
  { id: 'v121', name: 'Bar Niederlassung', to: 'isarvorstadt' },
  { id: 'v129', name: 'Karotte', to: 'isarvorstadt' },
  { id: 'v141', name: 'Bar Gabányi', to: 'isarvorstadt' },
  { id: 'v152', name: 'Bar München72', to: 'isarvorstadt' },
  { id: 'max-moritz-wine-bar', name: 'Max & Moritz Wine Bar', to: 'isarvorstadt' },
  { id: 'the-high-munchen', name: 'the High München', to: 'isarvorstadt' },
  { id: 'manu-weinbar-restaurant', name: 'manu. weinbar & restaurant', to: 'isarvorstadt' },
  { id: 'gebruder-keller-und-erben', name: 'Gebrüder Keller und Erben', to: 'isarvorstadt' },
  { id: 'kulturstrand-der-urbanauten', name: 'Kulturstrand der urbanauten', to: 'isarvorstadt' },
  { id: 'vinothek-by-geisel', name: 'Vinothek by Geisel', to: 'isarvorstadt' },
];

// Real addresses, Nominatim-confirmed (place_rank >= 26), correctly placed
// by their ACTUAL coordinates — several ended up in a different
// neighbourhood than the original request assumed; see file header.
const NEW_VENUES = [
  { name: 'Café Luitpold', type: 'restaurant', neighbourhood_id: 'maxvorstadt',
    address: 'Brienner Str. 11, 80333 München', lat: 48.1429694, lng: 11.574757,
    opening_hours: 'Mo–Sa 8:00–19:00, So 9:00–19:00',
    beers: [{ brand: 'Paulaner', size_05: 5.60, size_mass: null }] },
  { name: 'Goldene Bar', type: 'bar', neighbourhood_id: 'lehel',
    address: 'Prinzregentenstr. 1, 80538 München', lat: 48.1441766, lng: 11.5867056,
    opening_hours: 'Di–Sa 18:00–1:00',
    beers: [{ brand: 'Tegernseer', size_05: 6.40, size_mass: null }] },
  { name: 'Bar Centrale', type: 'bar', neighbourhood_id: 'altstadt',
    address: 'Ledererstraße 23, 80331 München', lat: 48.1368034, lng: 11.5797997,
    opening_hours: 'Mo–Sa 17:00–1:00',
    beers: [{ brand: 'Augustiner', size_05: 5.80, size_mass: null }] },
  { name: 'Café am Beethovenplatz', type: 'restaurant', neighbourhood_id: 'isarvorstadt',
    address: 'Goethestr. 51, 80336 München', lat: 48.1333879, lng: 11.5587693,
    opening_hours: 'Mo–So 8:00–24:00',
    beers: [{ brand: 'Hacker-Pschorr', size_05: 5.20, size_mass: null }] },
  { name: 'Prinz Myshkin', type: 'restaurant', neighbourhood_id: 'altstadt',
    address: 'Hackenstr. 2, 80331 München', lat: 48.1359275, lng: 11.5708218,
    opening_hours: 'Mo–So 11:30–23:00',
    beers: [{ brand: 'Augustiner', size_05: 5.40, size_mass: null }] },
  { name: 'Augustiner Bräustuben', type: 'beer_hall', neighbourhood_id: 'schwanthalerhoehe',
    address: 'Landsberger Str. 19, 80339 München', lat: 48.1392055, lng: 11.5456469,
    opening_hours: 'Mo–So 10:00–24:00',
    beers: [{ brand: 'Augustiner', size_05: 4.60, size_mass: 9.20 }] },
  { name: 'Zum Alten Markt', type: 'restaurant', neighbourhood_id: 'altstadt',
    address: 'Dreifaltigkeitsplatz 3, 80331 München', lat: 48.1352281, lng: 11.5775751,
    opening_hours: 'Mo–Sa 11:00–23:00',
    beers: [{ brand: 'Hofbräu München', size_05: 5.50, size_mass: null }] },
  { name: 'Holy Home', type: 'bar', neighbourhood_id: 'isarvorstadt',
    address: 'Reichenbachstraße 21, 80469 München', lat: 48.1311497, lng: 11.5760748,
    opening_hours: 'Mo–So 18:00–1:00',
    beers: [{ brand: 'Tegernseer', size_05: 5.90, size_mass: null }] },
  { name: 'Bar Giornale', type: 'bar', neighbourhood_id: 'schwabing',
    address: 'Leopoldstraße 7, 80802 München', lat: 48.1543184, lng: 11.5825441,
    opening_hours: 'Mo–So 17:00–1:00',
    beers: [{ brand: 'Paulaner', size_05: 6.10, size_mass: null }] },
  { name: 'Weißes Bräuhaus', type: 'beer_hall', neighbourhood_id: 'altstadt',
    address: 'Tal 7, 80331 München', lat: 48.1363952, lng: 11.5784219,
    opening_hours: 'Mo–So 8:00–24:00',
    beers: [{ brand: 'Schneider Weisse', size_05: 5.30, size_mass: null }] },
  { name: 'Braunauer Hof', type: 'restaurant', neighbourhood_id: 'altstadt',
    address: 'Frauenstraße 42, 80469 München', lat: 48.1342892, lng: 11.5810090,
    opening_hours: 'Mo–So 11:00–24:00',
    beers: [{ brand: 'Hofbräu München', size_05: 5.60, size_mass: null }] },
];

function runExpansion() {
  let neighbourhoodsAdded = 0;
  let venuesAdded = 0;

  console.log('🍺 Ludwigsvorstadt-Isarvorstadt expansion: neighbourhoods...');
  const existingHoodIds = new Set(getNeighbourhoods().map((n) => n.id));
  const insertHood = db.prepare(`
    INSERT INTO neighbourhoods (id, name_de, name_en, center_lat, center_lng, city_id)
    VALUES (@id, @name_de, @name_en, @center_lat, @center_lng, 1)
  `);
  for (const n of NEW_NEIGHBOURHOODS) {
    if (existingHoodIds.has(n.id)) {
      console.log(`   ⏭️  SKIP — neighbourhood already exists: ${n.name_de}`);
      continue;
    }
    insertHood.run(n);
    console.log(`   ✅ ADDED neighbourhood: ${n.name_de} (${n.id})`);
    neighbourhoodsAdded += 1;
  }

  // The REASSIGNMENTS step that used to run here is retired — see
  // backend/db/reassignVenues.js, which supersedes it with a real
  // point-in-polygon test against actual OpenStreetMap boundaries instead of
  // this file's hand-verified-but-still-approximate polygon. Keeping both
  // active was actively harmful, not just redundant: this list's targets
  // went stale the moment the real boundaries landed, so on every boot the
  // two scripts fought — this one silently undoing reassignVenues.js's
  // correct answer, which then immediately re-corrected it back, forever,
  // each pass adding a spurious pair of EDIT_VENUE entries to admin_logs.
  // REASSIGNMENTS itself is left in this file only as a record of the
  // session that produced it.

  console.log('🍺 Ludwigsvorstadt-Isarvorstadt expansion: new venues...');
  const existingNames = new Set(
    db.prepare('SELECT name FROM venues').all().map((v) => norm(v.name))
  );
  for (const v of NEW_VENUES) {
    if (existingNames.has(norm(v.name))) {
      console.log(`   ⏭️  SKIP — already exists: ${v.name}`);
      continue;
    }
    const { beers, ...venueFields } = v;
    const id = createVenue(venueFields, beers);
    logAdminAction('ADD_VENUE', {
      venueId: id,
      venueName: v.name,
      details: { name: v.name, neighbourhood: v.neighbourhood_id, type: v.type, source: 'expandLudwigsvorstadt.js' },
    });
    console.log(`   ✅ ADDED venue: ${v.name} (${v.neighbourhood_id}) -> id ${id}`);
    venuesAdded += 1;
    existingNames.add(norm(v.name));
  }

  console.log(`🍺 Expansion complete: ${neighbourhoodsAdded} neighbourhoods added, ${venuesAdded} venues added (venue reassignment now handled by reassignVenues.js). Total venues now: ${db.prepare('SELECT COUNT(*) AS n FROM venues').get().n}.`);
  return { neighbourhoodsAdded, venuesAdded };
}

if (require.main === module) {
  runExpansion();
}

module.exports = { runExpansion, NEW_NEIGHBOURHOODS, REASSIGNMENTS, NEW_VENUES };
