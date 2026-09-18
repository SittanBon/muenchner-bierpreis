// Approximate GeoJSON polygons for Munich Tier 1 Stadtteile
// Based on official Munich district boundaries (simplified)
//
// All 6 polygons tile cleanly — every shared border uses IDENTICAL
// coordinates in both adjacent polygons (verified computationally: zero
// self-intersections, zero pairwise overlap across all 15 polygon pairs).
// One correction was needed to get there: the given Altstadt/Isarvorstadt
// boundary wasn't actually identical on both sides — Altstadt traced two
// extra vertices ([11.556,48.134] and [11.557,48.139]) that Isarvorstadt's
// corresponding edge skipped straight past, which is exactly what produced
// the overlap this file fixes. Isarvorstadt now traces that same detail
// instead of cutting the corner. Lehel's northern edge (which doesn't
// border any other polygon here) was also nudged from 48.1430 to 48.1450
// at its western end — the given coordinates left Goldene Bar (Haus der
// Kunst, Prinzregentenstr. 1) just outside Lehel; all 4 real Lehel venues
// now fall inside.

export const neighbourhoodGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "altstadt" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5570, 48.1390],
          [11.5560, 48.1340],
          [11.5600, 48.1290],
          [11.5680, 48.1280],
          [11.5760, 48.1290],
          [11.5780, 48.1300],
          [11.5780, 48.1350],
          [11.5780, 48.1380],
          [11.5710, 48.1420],
          [11.5580, 48.1420],
          [11.5570, 48.1390]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "maxvorstadt" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5450, 48.1480],
          [11.5480, 48.1420],
          [11.5580, 48.1420],
          [11.5710, 48.1420],
          [11.5750, 48.1420],
          [11.5810, 48.1480],
          [11.5800, 48.1560],
          [11.5700, 48.1580],
          [11.5480, 48.1560],
          [11.5450, 48.1480]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "schwabing" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5480, 48.1560],
          [11.5700, 48.1580],
          [11.5800, 48.1560],
          [11.5810, 48.1480],
          [11.5900, 48.1580],
          [11.6050, 48.1650],
          [11.6000, 48.1750],
          [11.5700, 48.1750],
          [11.5480, 48.1700],
          [11.5480, 48.1560]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "lehel" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5780, 48.1380],
          [11.5780, 48.1350],
          [11.5780, 48.1300],
          [11.5830, 48.1270],
          [11.5920, 48.1260],
          [11.5980, 48.1280],
          [11.6010, 48.1320],
          [11.6030, 48.1380],
          [11.6020, 48.1420],
          [11.5950, 48.1450],
          [11.5850, 48.1450],
          [11.5780, 48.1420],
          [11.5780, 48.1380]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "isarvorstadt" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5420, 48.1390],
          [11.5380, 48.1320],
          [11.5430, 48.1200],
          [11.5550, 48.1150],
          [11.5700, 48.1150],
          [11.5800, 48.1200],
          [11.5830, 48.1270],
          [11.5780, 48.1300],
          [11.5760, 48.1290],
          [11.5680, 48.1280],
          [11.5600, 48.1290],
          [11.5560, 48.1340],
          [11.5570, 48.1390],
          [11.5580, 48.1420],
          [11.5480, 48.1420],
          [11.5450, 48.1420],
          [11.5420, 48.1390]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "schwanthalerhoehe" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5250, 48.1400],
          [11.5180, 48.1320],
          [11.5200, 48.1220],
          [11.5300, 48.1180],
          [11.5430, 48.1200],
          [11.5380, 48.1320],
          [11.5420, 48.1390],
          [11.5450, 48.1420],
          [11.5380, 48.1420],
          [11.5250, 48.1400]
        ]]
      }
    }
  ]
};
