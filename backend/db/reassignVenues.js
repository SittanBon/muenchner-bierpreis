// One-off migration: reassigns every venue's neighbourhood_id using a real
// point-in-polygon test against frontend/src/data/neighbourhoodGeoJSON.js's
// ACTUAL boundaries — imported by reading and parsing that exact file (not a
// duplicated copy), so the map's rendered shapes and this script's
// reassignment logic can never drift apart. Safe to run any number of times
// (each run just re-tests every venue against the current polygons; a venue
// already correctly assigned is a no-op).
//
//   node backend/db/reassignVenues.js   (or: npm run reassign:venues)
//
// Venues that fall outside all 6 polygons keep their current assignment —
// they're logged as OUTSIDE, not reassigned, exactly as requested. That's
// expected for real venues in Munich districts this app doesn't model yet
// (Haidhausen, Au, Untergiesing-Harlaching, Neuhausen-Nymphenburg, Sendling
// all show up here — see the session report for the specific venues).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, logAdminAction } = require('./database');

// Ray-casting point-in-polygon on a single [lng,lat] ring.
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
// A MultiPolygon matches if the point is inside ANY of its parts (holes
// aren't used by this dataset, so only ring[0] — the outer ring — matters).
function pointInMultiPolygon(pt, geometry) {
  if (geometry.type === 'Polygon') return pointInRing(pt, geometry.coordinates[0]);
  return geometry.coordinates.some((polygon) => pointInRing(pt, polygon[0]));
}

function loadNeighbourhoodGeoJSON() {
  const filePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'neighbourhoodGeoJSON.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const marker = 'export const neighbourhoodGeoJSON = ';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('Could not find neighbourhoodGeoJSON export in ' + filePath);
  let jsonText = src.slice(start + marker.length).trim();
  if (jsonText.endsWith(';')) jsonText = jsonText.slice(0, -1);
  return JSON.parse(jsonText);
}

function correctNeighbourhoodFor(lng, lat, fc) {
  for (const feature of fc.features) {
    if (pointInMultiPolygon([lng, lat], feature.geometry)) return feature.properties.id;
  }
  return null;
}

function runReassignment() {
  const fc = loadNeighbourhoodGeoJSON();
  const venues = db.prepare('SELECT id, name, neighbourhood_id, lat, lng FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL').all();
  const updateStmt = db.prepare('UPDATE venues SET neighbourhood_id = @to WHERE id = @id');

  let okCount = 0, reassignedCount = 0, outsideCount = 0;
  console.log(`🍺 Reassigning ${venues.length} venues against real OpenStreetMap boundaries...`);

  for (const v of venues) {
    const correct = correctNeighbourhoodFor(v.lng, v.lat, fc);
    if (correct === null) {
      console.log(`   ⚠️  OUTSIDE: ${v.name} at [${v.lat},${v.lng}] — manual check needed (kept as ${v.neighbourhood_id})`);
      outsideCount += 1;
    } else if (correct === v.neighbourhood_id) {
      okCount += 1; // not logged individually — 181 "OK" lines isn't useful signal; see the summary count
    } else {
      const from = v.neighbourhood_id;
      updateStmt.run({ id: v.id, to: correct });
      logAdminAction('EDIT_VENUE', {
        venueId: v.id,
        venueName: v.name,
        details: { field: 'neighbourhood_id', old_value: from, new_value: correct, source: 'reassignVenues.js (real OSM boundaries)' },
      });
      console.log(`   ✅ REASSIGNED: ${v.name} from ${from} to ${correct}`);
      reassignedCount += 1;
    }
  }

  console.log(`🍺 Reassignment complete: ${okCount} already correct, ${reassignedCount} reassigned, ${outsideCount} outside all 6 polygons (kept as-is, flagged).`);
  return { okCount, reassignedCount, outsideCount };
}

if (require.main === module) {
  runReassignment();
}

module.exports = { runReassignment, loadNeighbourhoodGeoJSON, pointInMultiPolygon };
