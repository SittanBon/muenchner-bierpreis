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
    {
      type: "Feature",
      properties: { id: "isarvorstadt" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [11.5620, 48.1310],
          [11.5700, 48.1295],
          [11.5820, 48.1300],
          [11.5870, 48.1340],
          [11.5900, 48.1290],
          [11.5870, 48.1230],
          [11.5800, 48.1200],
          [11.5700, 48.1190],
          [11.5620, 48.1220],
          [11.5580, 48.1270],
          [11.5620, 48.1310]
        ]]
      }
    }
  ]
};
