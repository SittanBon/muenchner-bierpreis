// One-off migration: aligns the app's neighbourhood structure with Munich's
// real Stadtbezirk boundaries.
//
//   1. Altstadt + Lehel are officially one district ("Altstadt-Lehel",
//      Stadtbezirk 1) — merged into the existing "altstadt" id.
//   2. "Schwabing" was modelled as one area but is officially two separate
//      districts (Schwabing-West = Stadtbezirk 4, Schwabing-Freimann =
//      Stadtbezirk 12) — split into "schwabing_west" + "schwabing_freimann".
//
// Reuses the exact polygon data already committed in
// frontend/src/data/neighbourhoodGeoJSON.js (read via reassignVenues.js's
// loader, never duplicated) — that file must already contain the merged
// "altstadt" feature and the split "schwabing_west"/"schwabing_freimann"
// features before this script runs.
//
// FK-safe ordering (venues.neighbourhood_id REFERENCES neighbourhoods(id),
// no ON UPDATE CASCADE, foreign_keys=ON): new rows are inserted and venues
// reassigned BEFORE the old "lehel"/"schwabing" rows are deleted, never the
// reverse.
//
// Idempotent — safe to run any number of times:
//   - the altstadt UPDATE is a plain field set, re-running just re-applies it
//   - "lehel"/"schwabing" rows are only deleted if they still exist and have
//     zero referencing venues left
//   - "schwabing_west"/"schwabing_freimann" are INSERT-if-not-exists
//   - venues already in schwabing_west/schwabing_freimann are left alone;
//     only venues still pointing at the old "schwabing" id are re-tested
//
//   node backend/db/restructureNeighbourhoods.js
//   (or: npm run restructure:neighbourhoods)
require('dotenv').config();
const { db, logAdminAction } = require('./database');
const { loadNeighbourhoodGeoJSON, pointInMultiPolygon } = require('./reassignVenues');

const ALTSTADT_LEHEL = {
  name_de: 'Altstadt-Lehel',
  name_en: 'Old Town & Lehel',
  short_name_de: 'Altstadt-Lehel',
  short_name_en: 'Altstadt-Lehel',
  center_lat: 48.1374,
  center_lng: 11.5820,
};

const SCHWABING_WEST = {
  id: 'schwabing_west',
  name_de: 'Schwabing-West',
  name_en: 'Schwabing West',
  center_lat: 48.1580,
  center_lng: 11.5700,
  city_id: 1,
};

const SCHWABING_FREIMANN = {
  id: 'schwabing_freimann',
  name_de: 'Schwabing-Freimann',
  name_en: 'Schwabing & Freimann',
  center_lat: 48.1720,
  center_lng: 11.5850,
  city_id: 1,
};

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const run = db.transaction(() => {
  const fc = loadNeighbourhoodGeoJSON();
  const schwabingWestFeature = fc.features.find((f) => f.properties.id === 'schwabing_west');
  const schwabingFreimannFeature = fc.features.find((f) => f.properties.id === 'schwabing_freimann');
  if (!schwabingWestFeature || !schwabingFreimannFeature) {
    throw new Error('neighbourhoodGeoJSON.js does not (yet) contain split schwabing_west/schwabing_freimann features — run the GeoJSON merge/split step first.');
  }

  const summary = { altstadtUpdated: false, lehelVenuesMoved: 0, lehelDeleted: false, schwabingWestInserted: false, schwabingFreimannInserted: false, schwabingVenuesAssignedWest: 0, schwabingVenuesAssignedFreimann: 0, schwabingVenuesNearestFallback: 0, schwabingDeleted: false };

  // ── 1. Combine Altstadt + Lehel ──────────────────────────────────────────
  db.prepare(`
    UPDATE neighbourhoods
    SET name_de = @name_de, name_en = @name_en,
        short_name_de = @short_name_de, short_name_en = @short_name_en,
        center_lat = @center_lat, center_lng = @center_lng
    WHERE id = 'altstadt'
  `).run(ALTSTADT_LEHEL);
  summary.altstadtUpdated = true;
  console.log('🍺 altstadt → name_de/name_en/short_name_de/short_name_en/center updated to Altstadt-Lehel');

  const lehelVenues = db.prepare("SELECT id, name FROM venues WHERE neighbourhood_id = 'lehel'").all();
  if (lehelVenues.length) {
    const moveStmt = db.prepare("UPDATE venues SET neighbourhood_id = 'altstadt' WHERE id = ?");
    for (const v of lehelVenues) {
      moveStmt.run(v.id);
      logAdminAction('EDIT_VENUE', {
        venueId: v.id,
        venueName: v.name,
        details: { field: 'neighbourhood_id', old_value: 'lehel', new_value: 'altstadt', source: 'restructureNeighbourhoods.js (Altstadt+Lehel merge)' },
      });
      console.log(`   ✅ MOVED (lehel→altstadt): ${v.name}`);
    }
    summary.lehelVenuesMoved = lehelVenues.length;
  }

  const lehelStillReferenced = db.prepare("SELECT COUNT(*) AS n FROM venues WHERE neighbourhood_id = 'lehel'").get().n;
  const lehelExists = db.prepare("SELECT 1 FROM neighbourhoods WHERE id = 'lehel'").get();
  if (lehelExists && lehelStillReferenced === 0) {
    db.prepare("DELETE FROM neighbourhoods WHERE id = 'lehel'").run();
    summary.lehelDeleted = true;
    console.log('🍺 lehel neighbourhood row deleted (0 venues reference it)');
  } else if (lehelExists) {
    console.log(`   ⚠️  lehel row kept — ${lehelStillReferenced} venue(s) still reference it (unexpected)`);
  }

  // ── 2. Split Schwabing into Schwabing-West / Schwabing-Freimann ─────────
  const westExists = db.prepare("SELECT 1 FROM neighbourhoods WHERE id = 'schwabing_west'").get();
  if (!westExists) {
    db.prepare(`
      INSERT INTO neighbourhoods (id, name_de, name_en, center_lat, center_lng, city_id)
      VALUES (@id, @name_de, @name_en, @center_lat, @center_lng, @city_id)
    `).run(SCHWABING_WEST);
    summary.schwabingWestInserted = true;
    console.log('🍺 schwabing_west neighbourhood inserted');
  }
  const freimannExists = db.prepare("SELECT 1 FROM neighbourhoods WHERE id = 'schwabing_freimann'").get();
  if (!freimannExists) {
    db.prepare(`
      INSERT INTO neighbourhoods (id, name_de, name_en, center_lat, center_lng, city_id)
      VALUES (@id, @name_de, @name_en, @center_lat, @center_lng, @city_id)
    `).run(SCHWABING_FREIMANN);
    summary.schwabingFreimannInserted = true;
    console.log('🍺 schwabing_freimann neighbourhood inserted');
  }

  const schwabingVenues = db.prepare("SELECT id, name, lat, lng FROM venues WHERE neighbourhood_id = 'schwabing'").all();
  if (schwabingVenues.length) {
    const moveStmt = db.prepare('UPDATE venues SET neighbourhood_id = ? WHERE id = ?');
    for (const v of schwabingVenues) {
      let target;
      let reason;
      if (v.lat != null && v.lng != null && pointInMultiPolygon([v.lng, v.lat], schwabingWestFeature.geometry)) {
        target = 'schwabing_west';
        reason = 'point-in-polygon';
      } else if (v.lat != null && v.lng != null && pointInMultiPolygon([v.lng, v.lat], schwabingFreimannFeature.geometry)) {
        target = 'schwabing_freimann';
        reason = 'point-in-polygon';
      } else if (v.lat != null && v.lng != null) {
        // Outside both — nearest by straight-line distance to the given centroids.
        const dWest = distanceKm(v.lat, v.lng, SCHWABING_WEST.center_lat, SCHWABING_WEST.center_lng);
        const dFreimann = distanceKm(v.lat, v.lng, SCHWABING_FREIMANN.center_lat, SCHWABING_FREIMANN.center_lng);
        target = dWest <= dFreimann ? 'schwabing_west' : 'schwabing_freimann';
        reason = `nearest-centroid fallback (${dWest.toFixed(2)}km vs ${dFreimann.toFixed(2)}km)`;
        summary.schwabingVenuesNearestFallback += 1;
      } else {
        // No coordinates at all — default to schwabing_west, flagged in the log.
        target = 'schwabing_west';
        reason = 'no coordinates — defaulted';
        summary.schwabingVenuesNearestFallback += 1;
      }

      moveStmt.run(target, v.id);
      logAdminAction('EDIT_VENUE', {
        venueId: v.id,
        venueName: v.name,
        details: { field: 'neighbourhood_id', old_value: 'schwabing', new_value: target, source: `restructureNeighbourhoods.js (Schwabing split, ${reason})` },
      });
      console.log(`   ✅ ASSIGNED: ${v.name} → ${target} (${reason})`);
      if (target === 'schwabing_west') summary.schwabingVenuesAssignedWest += 1;
      else summary.schwabingVenuesAssignedFreimann += 1;
    }
  }

  const schwabingStillReferenced = db.prepare("SELECT COUNT(*) AS n FROM venues WHERE neighbourhood_id = 'schwabing'").get().n;
  const schwabingExists = db.prepare("SELECT 1 FROM neighbourhoods WHERE id = 'schwabing'").get();
  if (schwabingExists && schwabingStillReferenced === 0) {
    db.prepare("DELETE FROM neighbourhoods WHERE id = 'schwabing'").run();
    summary.schwabingDeleted = true;
    console.log('🍺 schwabing neighbourhood row deleted (0 venues reference it)');
  } else if (schwabingExists) {
    console.log(`   ⚠️  schwabing row kept — ${schwabingStillReferenced} venue(s) still reference it (unexpected)`);
  }

  console.log('🍺 Restructure complete:', JSON.stringify(summary));
  return summary;
});

if (require.main === module) {
  run();
}

module.exports = { run };
