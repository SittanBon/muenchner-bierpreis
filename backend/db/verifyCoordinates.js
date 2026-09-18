// One-off, MANUAL-ONLY script: verifies every venue's GPS coordinates
// against Nominatim, updating anything that's moved more than 100m from a
// confident, same-city match. Deliberately NOT wired into server.js's boot
// sequence — unlike this project's other migrations, this one makes ~180-220
// live network calls at 1100ms apart (3-5+ minutes), which has no business
// running on every server restart and would hammer Nominatim's free public
// instance for no reason once it's already been run.
//
//   node backend/db/verifyCoordinates.js   (or: npm run verify:coordinates)
//
// Safe to re-run (each run just re-checks current coordinates), but there's
// no reason to unless venues change — this isn't idempotent in the "cheap
// no-op" sense migrate.js/reassignVenues.js are; it's a genuine full
// re-verification every time, costing the same 3-5 minutes and the same
// load on Nominatim again.
require('dotenv').config();
const { db } = require('./database');

const USER_AGENT = 'Bierpreis/1.0 (bierpreis@gmail.com)';
const RATE_LIMIT_MS = 1100;
// Same confidence gate as addMissingVenues.js/geocode.js — a low place_rank
// means Nominatim only matched a city/region/street, not a specific address
// or POI, which is exactly the kind of coarse match the 100m/same-city
// checks below can't fully catch on their own.
const MIN_PLACE_RANK = 26;
const DISTANCE_THRESHOLD_M = 100;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function nominatimSearch(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'de');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

// Haversine distance in metres.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rejects a result outside Munich — matches the task's explicit rule
// ("never update for a different city or country") using Nominatim's own
// address breakdown rather than just trusting the query string echoed back.
function isMunichGermany(result) {
  const addr = result.address || {};
  const cityLike = addr.city || addr.town || addr.municipality || addr.village || '';
  const country = addr.country || '';
  const cityOk = /münchen|munich/i.test(cityLike) || /münchen|munich/i.test(result.display_name || '');
  const countryOk = !country || /deutschland|germany/i.test(country);
  return cityOk && countryOk;
}

// A bare street-centerline match (addresstype/class "road"/"highway") isn't
// good enough to overwrite an existing coordinate with — found by testing
// this exact script against a real venue: the fallback address-only query
// for "Sendlinger Str. 72" returned Sendlinger Straße's centerline
// (place_rank 26, the same floor addMissingVenues.js/geocode.js use — but
// those accept a street-level fallback as a starting point for a BRAND NEW
// venue with no coordinate yet, not as grounds to move an EXISTING one).
// Moving a venue's pin to a generic point on its street, discarding a
// possibly-more-precise existing position, is a regression, not a fix.
function isPointLevel(result) {
  return result.addresstype !== 'road' && result.class !== 'highway';
}

function isConfident(result) {
  return !!result && Number(result.place_rank) >= MIN_PLACE_RANK && isMunichGermany(result) && isPointLevel(result);
}

async function verifyOne(venue) {
  let hit = null;
  let usedFallback = false;

  try {
    const [primary] = await nominatimSearch(`${venue.name}, ${venue.address}`);
    if (isConfident(primary)) hit = primary;
  } catch (e) {
    console.error(`   (primary search failed for "${venue.name}": ${e.message})`);
  }

  if (!hit && venue.address) {
    await sleep(RATE_LIMIT_MS);
    usedFallback = true;
    try {
      const [addrOnly] = await nominatimSearch(venue.address);
      if (isConfident(addrOnly)) hit = addrOnly;
    } catch (e) {
      console.error(`   (address-only search failed for "${venue.name}": ${e.message})`);
    }
  }

  if (!hit) {
    console.log(`   ⚪ NO RESULT: ${venue.name} — kept existing${usedFallback ? ' (tried name+address and address-only)' : ''}`);
    return { status: 'no_result' };
  }

  const newLat = Number(hit.lat), newLng = Number(hit.lon);
  const dist = venue.lat != null && venue.lng != null
    ? distanceMeters(venue.lat, venue.lng, newLat, newLng)
    : Infinity;

  if (dist > DISTANCE_THRESHOLD_M) {
    db.prepare('UPDATE venues SET lat = @lat, lng = @lng WHERE id = @id')
      .run({ id: venue.id, lat: newLat, lng: newLng });
    console.log(`   🔵 UPDATED: ${venue.name} moved ${Math.round(dist)}m from [${venue.lat},${venue.lng}] to [${newLat},${newLng}]`);
    return { status: 'updated', distance: dist };
  }
  console.log(`   ✅ OK: ${venue.name} accurate (${Math.round(dist)}m)`);
  return { status: 'ok', distance: dist };
}

async function runVerification() {
  const venues = db.prepare('SELECT id, name, address, lat, lng FROM venues ORDER BY name').all();
  console.log(`🍺 Verifying ${venues.length} venue coordinates against Nominatim (this takes a few minutes — 1100ms between requests)...`);

  const counts = { updated: 0, ok: 0, no_result: 0 };
  for (const v of venues) {
    if (!v.address) {
      console.log(`   ⚪ NO RESULT: ${v.name} — no address on file, kept existing`);
      counts.no_result += 1;
    } else {
      const r = await verifyOne(v);
      counts[r.status] += 1;
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`🍺 Verification complete: ${counts.updated} updated, ${counts.ok} OK, ${counts.no_result} no result.`);
  return counts;
}

if (require.main === module) {
  runVerification().catch((e) => { console.error('Verification failed:', e); process.exit(1); });
}

module.exports = { runVerification, distanceMeters, isMunichGermany, isConfident };
