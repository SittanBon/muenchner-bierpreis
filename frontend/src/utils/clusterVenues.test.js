import { describe, it, expect } from 'vitest';
import { clusterVenuesByPixel, separatingZoom, PILL_SIZE_MOBILE, PILL_SIZE_DESKTOP } from './clusterVenues';

// Standard web-mercator projection (what Leaflet's map.project does), 256px tiles.
const project = ([lat, lng], zoom) => {
  const scale = 256 * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
};
const v = (id, lat, lng) => ({ id, lat, lng });
const near = (id, metresEast, base = { lat: 48.1374, lng: 11.5755 }) => v(id, base.lat, base.lng + metresEast / (111320 * Math.cos((base.lat * Math.PI) / 180)));

describe('clusterVenuesByPixel', () => {
  it('venues far apart are separate pills; venues on top of each other form one cluster', () => {
    const groups = clusterVenuesByPixel(project, [near('a', 0), near('b', 5), near('c', 3000)], 13);
    expect(groups.map((g) => g.map((x) => x.id).sort())).toEqual([['a', 'b'], ['c']]);
  });
  it('the same venues separate as you zoom in', () => {
    const list = [near('a', 0), near('b', 60)];
    expect(clusterVenuesByPixel(project, list, 13)).toHaveLength(1);  // 60 m ≈ 5 px at zoom 13
    expect(clusterVenuesByPixel(project, list, 18)).toHaveLength(2);  // ≈ 160 px at zoom 18
  });
  it('overlap is a rectangle: wide-but-not-tall does not collide', () => {
    // Same latitude, 45 px apart horizontally at zoom 15 -> inside the 58 px width AND 0 px tall -> cluster
    const w = 45 * (40075016 * Math.cos((48.1374 * Math.PI) / 180) / (256 * 2 ** 15));
    expect(clusterVenuesByPixel(project, [near('a', 0), near('b', w)], 15)).toHaveLength(1);
    // 70 px apart -> beyond the width -> two pills
    expect(clusterVenuesByPixel(project, [near('a', 0), near('b', w * (70 / 45))], 15)).toHaveLength(2);
  });
  it('desktop pills are larger, so they cluster a little sooner', () => {
    const w = 61 * (40075016 * Math.cos((48.1374 * Math.PI) / 180) / (256 * 2 ** 15));
    const list = [near('a', 0), near('b', w)];
    expect(clusterVenuesByPixel(project, list, 15, PILL_SIZE_MOBILE)).toHaveLength(2);
    expect(clusterVenuesByPixel(project, list, 15, PILL_SIZE_DESKTOP)).toHaveLength(1);
  });
  it('venues without coordinates are left out', () => {
    expect(clusterVenuesByPixel(project, [v('x', null, null), near('a', 0)], 13)).toEqual([[near('a', 0)]]);
  });
});

describe('separatingZoom — where to zoom so a picked venue can be highlighted', () => {
  const dense = [near('a', 0), near('b', 40), near('c', 90), near('far', 4000)];
  it('a venue that already stands alone needs no extra zoom', () => expect(separatingZoom(dense[3], dense, project, 13)).toBe(13));
  it('a venue inside a cluster: the first zoom at which it is alone', () => {
    const z = separatingZoom(dense[1], dense, project, 13);
    expect(z).toBeGreaterThan(13);
    const group = clusterVenuesByPixel(project, dense, z).find((g) => g.some((x) => x.id === 'b'));
    expect(group).toHaveLength(1);
    // …and it was NOT alone one level earlier
    const before = clusterVenuesByPixel(project, dense, z - 1).find((g) => g.some((x) => x.id === 'b'));
    expect(before.length).toBeGreaterThan(1);
  });
  it('never zooms out, and never past the max zoom (two venues at the same spot cannot be separated)', () => {
    expect(separatingZoom(dense[1], dense, project, 16)).toBeGreaterThanOrEqual(16);
    const twins = [near('t1', 0), near('t2', 0)];
    expect(separatingZoom(twins[0], twins, project, 13)).toBe(18);
    expect(separatingZoom(twins[0], twins, project, 13, { maxZoom: 16 })).toBe(16);
  });
  it('a venue with no coordinates leaves the zoom alone', () => {
    expect(separatingZoom(v('x', null, null), dense, project, 14)).toBe(14);
    expect(separatingZoom(null, dense, project, 14)).toBe(14);
  });
});
