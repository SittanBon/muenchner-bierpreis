// Marker clustering by SCREEN pixels, and "how far must I zoom for this venue to stand alone".
// Pure: the map supplies `project(latlng, zoom) -> {x, y}` (Leaflet's map.project), so the rules
// are unit-tested without a map.
//
// Price pills are wider than tall, so two of them collide when their centres are within a
// pill's WIDTH horizontally AND HEIGHT vertically — a rectangle test, not a circle.
export const PILL_SIZE_MOBILE = { w: 58, h: 30 };   // ≈ one 28px-tall pill ("€4,20 ?")
export const PILL_SIZE_DESKTOP = { w: 64, h: 34 };  // desktop pills are 32px tall and set a touch larger
export const MAX_ZOOM = 18;

const hasCoords = (v) => v.lat != null && v.lng != null;

// Groups of venues that would overlap at `zoom`. A group of one is a single pill.
export function clusterVenuesByPixel(project, venues, zoom, size = PILL_SIZE_MOBILE) {
  const pts = venues.filter(hasCoords).map((v) => ({ v, p: project([v.lat, v.lng], zoom) }));
  const used = new Array(pts.length).fill(false);
  const clusters = [];
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    const group = [pts[i].v];
    used[i] = true;
    for (let j = i + 1; j < pts.length; j++) {
      if (used[j]) continue;
      if (Math.abs(pts[i].p.x - pts[j].p.x) < size.w && Math.abs(pts[i].p.y - pts[j].p.y) < size.h) {
        group.push(pts[j].v);
        used[j] = true;
      }
    }
    clusters.push(group);
  }
  return clusters;
}

// The smallest zoom >= fromZoom at which `venue` is its own pill (not inside a cluster) — the zoom to
// go to when a venue is picked from the list, so its marker can actually be highlighted. Capped at
// maxZoom (two venues at the very same spot can never be separated). A venue with no coordinates
// can't be placed: the zoom is left as it is.
export function separatingZoom(venue, venues, project, fromZoom, { maxZoom = MAX_ZOOM, size = PILL_SIZE_MOBILE } = {}) {
  if (!venue || !hasCoords(venue)) return fromZoom;
  for (let z = fromZoom; z < maxZoom; z++) {
    const group = clusterVenuesByPixel(project, venues, z, size).find((g) => g.some((v) => v.id === venue.id));
    if (group && group.length === 1) return z;
  }
  return Math.max(fromZoom, maxZoom);
}
