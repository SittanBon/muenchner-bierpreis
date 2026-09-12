// One-off geocoding pass over every venue's stored address, via OpenStreetMap
// Nominatim (no API key). Safe to re-run: a venue that already resolves is
// just updated again with the same coordinates; nothing is ever deleted.
//
// Nominatim's usage policy requires a real User-Agent and a max of 1 request/
// second — both respected below (RATE_LIMIT_MS between every call, no
// concurrency).
//
// CONFIDENCE NOTE: Nominatim has no field literally called "confidence". The
// obvious stand-in, `importance` (0-1), turns out to be the wrong signal for
// this job — verified against the live API before wiring this up:
//   "Marienplatz 1, München" (Munich's most famous square) -> importance 0.157
//   a deliberately vague, city-only match ("München")      -> importance 0.811
// `importance` tracks how FAMOUS a place is, not how PRECISELY the query
// matched — an accurate small-business address will almost always score
// under 0.3, while a useless city-level fallback scores highest. A literal
// ">0.5" gate on it would reject nearly every correct match and accept the
// wrong kind of bad one. `place_rank` is what Nominatim actually uses to
// encode match specificity (~30 = building/POI, ~26-28 = street, <20 =
// city/region) and is what's checked below instead.
require('dotenv').config();
const { db, getVenuesAdmin } = require('./database');

const USER_AGENT = 'Bierpreis/1.0 (bierpreis@gmail.com)';
const RATE_LIMIT_MS = 1100;
const MIN_PLACE_RANK = 26; // street/POI precision or better — rejects city/region-level fallbacks

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const updateCoordsStmt = db.prepare('UPDATE venues SET lat = ?, lng = ? WHERE id = ?');

function isConfident(result) {
  return !!result && Number(result.place_rank) >= MIN_PLACE_RANK;
}

async function geocodeVenue(venue) {
  // 1) Try the stored address.
  if (venue.address) {
    try {
      const [result] = await nominatimSearch(venue.address);
      if (isConfident(result)) return result;
    } catch (err) {
      console.error(`   (address search failed for ${venue.name}: ${err.message})`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  // 2) Fall back to "<name>, München" — a landmark-style venue name (e.g. a
  // beer garden) often geocodes better alone than via its raw street address.
  try {
    const [fallback] = await nominatimSearch(`${venue.name}, München`);
    if (isConfident(fallback)) return fallback;
  } catch (err) {
    console.error(`   (name search failed for ${venue.name}: ${err.message})`);
  }
  return null;
}

async function run() {
  const venues = getVenuesAdmin();
  console.log(`🌍 Geocoding ${venues.length} venue(s) via Nominatim (${RATE_LIMIT_MS}ms between requests)…\n`);

  let updated = 0;
  let kept = 0;
  let manual = 0;

  for (const [i, venue] of venues.entries()) {
    const result = await geocodeVenue(venue);

    if (result) {
      const newLat = parseFloat(result.lat);
      const newLng = parseFloat(result.lon);
      const oldCoords = venue.lat != null && venue.lng != null ? `[${venue.lat}, ${venue.lng}]` : '[none]';
      console.log(`✅ Updated ${venue.name}: ${oldCoords} → [${newLat}, ${newLng}]`);
      updateCoordsStmt.run(newLat, newLng, venue.id);
      updated++;
    } else if (venue.lat != null && venue.lng != null) {
      // Nothing better found, but it already has usable coordinates — leave
      // them alone, no need to flag it.
      kept++;
    } else {
      console.log(`⚠️  Manual check needed: ${venue.name} (${venue.address || 'no address on file'})`);
      manual++;
    }

    // Rate limit — skip the wait after the very last venue.
    if (i < venues.length - 1) await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nUpdated: ${updated} | Kept: ${kept} | Manual check: ${manual}`);
}

run().catch((err) => {
  console.error('Geocoding run failed:', err);
  process.exit(1);
});
