// Approximate GeoJSON polygons for Munich Tier 1 Stadtteile
// Based on official Munich district boundaries (simplified)

export const neighbourhoodGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "altstadt" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5620, 48.1310],
          [11.5700, 48.1295],
          [11.5820, 48.1300],
          [11.5870, 48.1340],
          [11.5850, 48.1410],
          [11.5780, 48.1430],
          [11.5700, 48.1420],
          [11.5630, 48.1395],
          [11.5610, 48.1350],
          [11.5620, 48.1310]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "maxvorstadt" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5480, 48.1420],
          [11.5620, 48.1395],
          [11.5700, 48.1420],
          [11.5780, 48.1430],
          [11.5790, 48.1510],
          [11.5760, 48.1560],
          [11.5680, 48.1570],
          [11.5560, 48.1540],
          [11.5470, 48.1500],
          [11.5460, 48.1450],
          [11.5480, 48.1420]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "schwabing" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5560, 48.1540],
          [11.5680, 48.1570],
          [11.5760, 48.1560],
          [11.5850, 48.1570],
          [11.5960, 48.1580],
          [11.6010, 48.1650],
          [11.5970, 48.1730],
          [11.5870, 48.1750],
          [11.5720, 48.1720],
          [11.5600, 48.1680],
          [11.5510, 48.1620],
          [11.5480, 48.1560],
          [11.5560, 48.1540]
        ]]
      }
    },
    // The three below are placed LAST deliberately: Leaflet draws (and hit-tests)
    // GeoJSON features in array order, later features on top. The expanded
    // Isarvorstadt polygon below — now covering the full official
    // "Ludwigsvorstadt-Isarvorstadt" district, not just its eastern half —
    // geometrically overlaps the three polygons above in places (their own
    // boundaries were hand-approximated in an earlier session and drawn more
    // generously than the real district lines). Rather than leave that
    // overlap ambiguous, these three (the ones just verified against real
    // landmarks/postal codes for this fix) take visual and click priority in
    // the disputed area. A follow-up trimming Altstadt/Maxvorstadt's own
    // southern edges to remove the underlying overlap entirely is still
    // worth doing but wasn't attempted here — see the session report.
    {
      type: "Feature",
      properties: { id: "isarvorstadt" },
      geometry: {
        type: "Polygon",
        // Expanded to the full official Ludwigsvorstadt-Isarvorstadt district
        // (was: Isarvorstadt's eastern half only). Verified against Marienplatz,
        // Frauenkirche and Stachus — all correctly fall outside. Verified
        // against Viktualienmarkt, which falls marginally inside on paper (the
        // real Frauenstraße boundary and Viktualienmarkt's own latitude are
        // almost coincident); kept as given since it's a genuine close call,
        // not a clear displacement — see the one venue (Der Pschorr) excluded
        // from reassignment for this exact reason in the session report.
        coordinates: [[
          [11.532, 48.133],
          [11.535, 48.128],
          [11.548, 48.120],
          [11.565, 48.118],
          [11.582, 48.118],
          [11.590, 48.125],
          [11.587, 48.132],
          [11.578, 48.135],
          [11.570, 48.137],
          [11.565, 48.140],
          [11.558, 48.143],
          [11.543, 48.143],
          [11.535, 48.138],
          [11.532, 48.133]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "lehel" },
      geometry: {
        type: "Polygon",
        // Western edge nudged east from the originally-given 11.578 to
        // ~11.583/11.584 (just past Isartor) — the original value put the
        // Hofbräuhaus (Platzl), the whole Tal street corridor and Viktualienmarkt
        // inside Lehel, which is not correct by any real-world definition;
        // see the session report for the specific landmark checks. Everything
        // else (the Isar-side edges) kept exactly as given.
        coordinates: [[
          [11.584, 48.135],
          [11.587, 48.132],
          [11.590, 48.125],
          [11.598, 48.130],
          [11.605, 48.137],
          [11.600, 48.143],
          [11.583, 48.141],
          [11.584, 48.135]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { id: "schwanthalerhoehe" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.520, 48.138],
          [11.515, 48.130],
          [11.520, 48.125],
          [11.528, 48.128],
          [11.532, 48.133],
          [11.535, 48.138],
          [11.545, 48.143],
          [11.532, 48.143],
          [11.520, 48.138]
        ]]
      }
    }
  ]
};
