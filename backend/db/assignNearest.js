// One-off, MANUAL-ONLY script: assigns the specific venues that fall outside
// all 6 modelled neighbourhood polygons to their nearest neighbourhood by
// straight-line distance to a fixed centroid, and flags them
// outside_modelled_area so the admin UI can show they're approximate.
// Deliberately NOT wired into server.js's boot sequence — this targets a
// specific, named, already-diagnosed list of venues (real Munich addresses
// in districts this app doesn't have polygon data for: Haidhausen, Au,
// Untergiesing-Harlaching, Neuhausen-Nymphenburg, Sendling), not a general
// rule to re-run automatically; if a NEW venue later needs this treatment it
// should be added here deliberately, not caught by a blanket boot-time scan.
//
//   node backend/db/assignNearest.js   (or: npm run assign:nearest)
//
// Uses each venue's CURRENT coordinates at run time — run this after
// verifyCoordinates.js if both are being run together, so the nearest-
// centroid distance reflects any coordinate corrections that made.
require('dotenv').config();
const { db } = require('./database');

const CENTROIDS = {
  altstadt: [48.1374, 11.5755],
  lehel: [48.1390, 11.5920],
  maxvorstadt: [48.1497, 11.5655],
  schwabing: [48.1620, 11.5810],
  isarvorstadt: [48.1285, 11.5680],
  schwanthalerhoehe: [48.1320, 11.5430],
};

// The specific venues this applies to, named exactly as given.
const TARGET_NAMES = [
  'Hofbräukeller am Wiener Platz',
  'Rustikeria',
  'Boazn - Öffentliche Bedürfnisanstalt',
  'Wirtshaus in der Au',
  'Bar München72',
  'Sommerquartier',
  'Crönlein',
  'Gorilla Bar',
  'Wein Feldmann Weinbar',
  'Alte Utting',
];

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighbourhood(lat, lng) {
  let best = null, bestDist = Infinity;
  for (const [id, [clat, clng]] of Object.entries(CENTROIDS)) {
    const d = distanceKm(lat, lng, clat, clng);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return { id: best, distanceKm: bestDist };
}

function runAssignment() {
  const updateStmt = db.prepare('UPDATE venues SET neighbourhood_id = @hood, outside_modelled_area = 1 WHERE id = @id');
  let assigned = 0, notFound = 0;

  console.log(`🍺 Assigning ${TARGET_NAMES.length} outside venues to their nearest neighbourhood centroid...`);
  for (const name of TARGET_NAMES) {
    const venue = db.prepare('SELECT id, name, neighbourhood_id, lat, lng FROM venues WHERE name = ?').get(name);
    if (!venue) {
      console.log(`   ⚠️  NOT FOUND: ${name} — no venue with this exact name locally`);
      notFound += 1;
      continue;
    }
    if (venue.lat == null || venue.lng == null) {
      console.log(`   ⚠️  SKIP: ${venue.name} has no coordinates`);
      continue;
    }
    const { id: nearestId, distanceKm: dist } = nearestNeighbourhood(venue.lat, venue.lng);
    updateStmt.run({ id: venue.id, hood: nearestId });
    console.log(`   📍 NEAREST: ${venue.name} → ${nearestId} (${dist.toFixed(2)}km away)${venue.neighbourhood_id !== nearestId ? ` [was ${venue.neighbourhood_id}]` : ' [unchanged]'}`);
    assigned += 1;
  }

  console.log(`🍺 Assignment complete: ${assigned} assigned + flagged outside_modelled_area, ${notFound} not found locally.`);
  return { assigned, notFound };
}

if (require.main === module) {
  runAssignment();
}

module.exports = { runAssignment, distanceKm, nearestNeighbourhood, CENTROIDS, TARGET_NAMES };
