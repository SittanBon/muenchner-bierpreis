// One-off correction for the 14 venues that ended up with placeholder
// (neighbourhood-centre) coordinates after the initial add — see
// backend/db/addMissingVenues.js. Real street addresses were researched by
// hand (web search) rather than guessed, then run through the same
// Nominatim + place_rank confidence gate as geocode.js.
//
// NOTE: this list was independently verified against the live database
// before writing it — it differs from an earlier version of "the 14" that
// included 4 venues (Vertigo, Mistinguett, Weinbar Garbo, nineOfive) which
// had actually already geocoded successfully in the original run, while
// omitting 4 Maxvorstadt venues that were still genuinely on placeholder
// coordinates (24/7 Bites and Delights, Bier Und Wurst, Vinothek by Geisel,
// L'Oca Bianca). This script targets the venues actually still on the
// neighbourhood-centre placeholder, confirmed by comparing each venue's
// lat/lng against its neighbourhood's centre point.
require('dotenv').config();
const { db, getVenuesAdmin } = require('./database');

const USER_AGENT = 'Bierpreis/1.0 (bierpreis@gmail.com)';
const RATE_LIMIT_MS = 1100;
const MIN_PLACE_RANK = 26; // same confidence gate as geocode.js — see that file for why

const ADDRESSES = {
  'LUX Bar & Restaurant': 'Ledererstraße 13, 80331 München',
  'Barele': 'Hochbrückenstraße 4, 80331 München',
  'Max & Moritz Wine Bar': 'Westenriederstraße 9, 80331 München',
  'the High München': 'Blumenstraße 15, 80331 München',
  'manu. weinbar & restaurant': 'Rumfordstraße 1, 80469 München',
  'Gebrüder Keller und Erben': 'Klenzestraße 1, 80469 München',
  'Kulturstrand der urbanauten': 'Corneliusbrücke, 80469 München',
  'Dizzy Daisy Weinbar': 'Thalkirchner Straße 10, 80337 München',
  'Blaue Libelle': 'Hans-Sachs-Straße 3, 80469 München',
  '24/7 Bites and Delights': 'Amalienstraße 57, 80799 München',
  'Bier Und Wurst': 'Dachauer Straße 7a, 80335 München',
  'Vinothek by Geisel': 'Schützenstraße 11, 80335 München',
  "L'Oca Bianca": 'Alter Messeplatz 6, 80339 München',
  'Bā Mirano': 'Wilhelmstraße 27, 80801 München',
};

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function nominatimSearch(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'de,at');
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  return res.json();
}

const updateCoordsStmt = db.prepare('UPDATE venues SET lat = ?, lng = ?, address = ? WHERE id = ?');

async function run() {
  const venues = getVenuesAdmin();
  const names = Object.keys(ADDRESSES);
  console.log(`🌍 Re-geocoding ${names.length} venue(s) with real addresses…\n`);

  let updated = 0;
  let manual = 0;

  for (const [i, name] of names.entries()) {
    const venue = venues.find((v) => v.name === name);
    if (!venue) {
      console.log(`⚠️  Not found in DB: ${name}`);
      manual++;
      continue;
    }
    const address = ADDRESSES[name];
    let result = null;
    try {
      const [hit] = await nominatimSearch(address);
      if (hit && Number(hit.place_rank) >= MIN_PLACE_RANK) result = hit;
    } catch (err) {
      console.error(`   (search failed for ${name}: ${err.message})`);
    }

    if (result) {
      const newLat = parseFloat(result.lat);
      const newLng = parseFloat(result.lon);
      console.log(`✅ ${name}`);
      console.log(`   address: ${address}`);
      console.log(`   ${venue.lat}, ${venue.lng} → ${newLat}, ${newLng}`);
      updateCoordsStmt.run(newLat, newLng, address, venue.id);
      updated++;
    } else {
      console.log(`⚠️  Manual check needed: ${name} (${address}) — no confident Nominatim match`);
      manual++;
    }

    if (i < names.length - 1) await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nUpdated: ${updated} | Manual check: ${manual}`);
}

run().catch((err) => {
  console.error('fixPlaceholderCoords run failed:', err);
  process.exit(1);
});
