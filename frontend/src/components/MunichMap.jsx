import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { neighbourhoodGeoJSON } from '../data/neighbourhoodGeoJSON';
import { formatEuro } from '../utils/price';

// Price → colour scale (amber/brown tones — Bavarian feel)
function priceToColor(price, min = 4.40, max = 6.30) {
  const t = Math.max(0, Math.min(1, (price - min) / (max - min)));
  // Light amber (cheap) → deep amber-brown (expensive)
  const r = Math.round(255 - t * 60);
  const g = Math.round(200 - t * 110);
  const b = Math.round(80 - t * 60);
  return `rgb(${r},${g},${b})`;
}

// One colour + emoji per venue type — same emoji already used elsewhere
// (VenuePanel/VenueDetail's TYPE_ICONS) for a consistent visual vocabulary.
const TYPE_META = {
  beer_garden: { emoji: '🌳', color: '#2d7a2d' },
  beer_hall: { emoji: '🏛️', color: '#7a4a06' },
  bar: { emoji: '🍺', color: '#e8a020' },
  restaurant: { emoji: '🍽️', color: '#5a3d1e' },
};
const DEFAULT_TYPE_META = { emoji: '🍺', color: '#e8a020' };

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// "Overlap" only means anything in SCREEN pixels, not metres — the same 25m
// gap between two venues is a couple of pixels (invisible) at a city-wide
// zoom but many pin-widths apart (clearly separate) at street-level zoom. So
// clustering has to be computed from each venue's PROJECTED pixel position
// at the map's current zoom, and re-computed on every zoomend — a fixed
// metre threshold would either never fire while zoomed in, or (as measured
// against zoom 13, where 25m is ~2px) leave genuinely overlapping pins
// un-clustered, silently stacked on top of each other with the topmost one
// eating every click meant for the one underneath.
const CLUSTER_PIXEL_RADIUS = 36; // roughly one pin's own width

function clusterVenuesByPixel(map, venues, zoom) {
  const pts = venues
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({ v, p: map.project([v.lat, v.lng], zoom) }));
  const used = new Array(pts.length).fill(false);
  const clusters = [];
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    const group = [pts[i].v];
    used[i] = true;
    for (let j = i + 1; j < pts.length; j++) {
      if (used[j]) continue;
      const dx = pts[i].p.x - pts[j].p.x;
      const dy = pts[i].p.y - pts[j].p.y;
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_PIXEL_RADIUS) {
        group.push(pts[j].v);
        used[j] = true;
      }
    }
    clusters.push(group);
  }
  return clusters;
}

export default function MunichMap({ neighbourhoods, venues, onNeighbourhoodClick, onVenueClick, activeId, selectedVenueId, highlight = false }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const layerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (leafletMap.current || !mapRef.current) return;

    const L = window.L;
    leafletMap.current = L.map(mapRef.current, {
      center: [48.145, 11.578],
      zoom: 13,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap.current);

    // OpenStreetMap standard tiles — free, no API key
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(leafletMap.current);

    // Custom attribution style
    const attr = document.querySelector('.leaflet-control-attribution');
    if (attr) attr.style.cssText = 'font-size:9px;background:rgba(255,255,255,0.7);padding:2px 4px;';

  }, []);

  // Rebuild the GeoJSON layer whenever the (already filtered/searched) venue set,
  // the active neighbourhood, the highlight flag or the language changes.
  useEffect(() => {
    if (!leafletMap.current || !neighbourhoods.length) return;
    const L = window.L;

    if (layerRef.current) layerRef.current.remove();

    const statsById = {};
    neighbourhoods.forEach(n => { statsById[n.id] = n; });

    // `venues` already has all filters + the text search applied upstream, so a
    // neighbourhood with no rows here simply has nothing matching the query.
    const filteredStats = {};
    neighbourhoods.forEach(n => {
      const nv = venues.filter(v => v.neighbourhood_id === n.id && v.beers[0]?.size_05 != null);
      if (nv.length) {
        const avg = nv.reduce((s, v) => s + v.beers[0].size_05, 0) / nv.length;
        filteredStats[n.id] = { avg: Math.round(avg * 100) / 100, count: nv.length };
      }
    });

    layerRef.current = L.geoJSON(neighbourhoodGeoJSON, {
      style: (feature) => {
        const id = feature.properties.id;
        const stat = filteredStats[id];
        const isActive = activeId === id;
        const isHovered = hoveredId === id;
        const hasFilteredData = !!stat;
        // When a search is running, ring the neighbourhoods that still have matches.
        const isMatch = highlight && hasFilteredData;

        // Overlays stay subtle at all times so the map tiles underneath read clearly —
        // only a light fill tint plus a crisp border communicates state. Fill opacity
        // never exceeds ~0.3 even when active/hovered/matched; the border colour/weight
        // does the heavy lifting for feedback instead.
        return {
          fillColor: hasFilteredData ? priceToColor(stat.avg) : '#d4cfc8',
          fillOpacity: isActive ? 0.30 : isHovered ? 0.25 : isMatch ? 0.22 : hasFilteredData ? 0.15 : 0.08,
          color: isActive ? '#1a0a00' : isHovered ? '#3d1f00' : isMatch ? '#c88010' : '#6b4c1e',
          weight: isActive ? 2.5 : isHovered ? 2 : isMatch ? 3 : 1.5,
          dashArray: hasFilteredData ? null : '4 4'
        };
      },
      onEachFeature: (feature, layer) => {
        const id = feature.properties.id;
        const nInfo = statsById[id];
        const stat = filteredStats[id];
        const name = i18n.language === 'de' ? nInfo?.name_de : nInfo?.name_en;

        layer.on({
          mouseover: () => {
            setHoveredId(id);
            layer.setStyle({
              fillOpacity: 0.72,
              weight: 2,
              color: '#3d1f00'
            });

            // Show tooltip
            if (tooltipRef.current) {
              const tip = tooltipRef.current;
              tip.style.display = 'block';
              tip.innerHTML = stat
                ? `<div class="map-tooltip">
                    <div class="tt-name">${name}</div>
                    <div class="tt-price">Ø <strong>${formatEuro(stat.avg, i18n.language)}</strong></div>
                    <div class="tt-count">${stat.count} ${t('map.venues')}</div>
                   </div>`
                : `<div class="map-tooltip">
                    <div class="tt-name">${name}</div>
                    <div class="tt-nodata">${t('map.noData')}</div>
                   </div>`;
            }
          },
          mousemove: (e) => {
            if (tooltipRef.current) {
              const container = mapRef.current.getBoundingClientRect();
              const x = e.originalEvent.clientX - container.left;
              const y = e.originalEvent.clientY - container.top;
              tooltipRef.current.style.left = (x + 16) + 'px';
              tooltipRef.current.style.top = (y - 10) + 'px';
            }
          },
          mouseout: () => {
            setHoveredId(null);
            const isMatch = highlight && stat;
            layer.setStyle({
              fillOpacity: activeId === id ? 0.30 : isMatch ? 0.22 : stat ? 0.15 : 0.08,
              weight: activeId === id ? 2.5 : isMatch ? 3 : 1.5,
              color: activeId === id ? '#1a0a00' : isMatch ? '#c88010' : '#6b4c1e'
            });
            if (tooltipRef.current) tooltipRef.current.style.display = 'none';
          },
          click: () => {
            // Every neighbourhood polygon is selectable, even when the current
            // filters leave it with no venues — the panel then explains why.
            // (Previously this also zoomed the map to level 14 on the clicked
            // neighbourhood — after 2-3 clicks that pushed the OTHER polygons
            // far enough outside the viewport that Leaflet's SVG renderer
            // stopped drawing them at all, making them unclickable. Selection
            // must never depend on how far the map happens to be zoomed/panned.)
            onNeighbourhoodClick(id);
          }
        });
      }
    }).addTo(leafletMap.current);

  }, [neighbourhoods, venues, activeId, highlight, i18n.language]);

  // Venue pins — one colour-coded, type-icon marker per venue with GPS
  // coordinates (pins that overlap on screen at the current zoom collapse
  // into a single numbered cluster pin instead of silently stacking, which
  // would leave everything but the topmost one unclickable). Rebuilt
  // whenever the (already filtered/searched) venue set, the active
  // neighbourhood, the selected venue, or the map's own zoom changes — kept
  // in its own layer/effect from the neighbourhood polygons so a search that
  // narrows venues doesn't redraw the whole GeoJSON layer. Clicking a pin
  // never touches the map's view/zoom — only the sidebar/bottom-sheet
  // reacts (via onVenueClick); clicking a CLUSTER does zoom in, since that's
  // what actually separates its pins back out.
  useEffect(() => {
    if (!leafletMap.current) return;
    const L = window.L;
    const map = leafletMap.current;

    // A 44x44 icon box is the actual click/touch target on every screen size
    // (comfortably clears the 44x44 mobile minimum) — the visible circle
    // inside is styled smaller (32px desktop / 38px mobile) and centred
    // within that box entirely via CSS, so the anchor point never shifts
    // between breakpoints.
    const iconSize = [44, 44];
    const iconAnchor = [22, 22];

    function buildMarkers() {
      if (markersLayerRef.current) markersLayerRef.current.remove();

      const markers = clusterVenuesByPixel(map, venues, map.getZoom()).map((group) => {
        if (group.length > 1) {
          const lat = group.reduce((s, v) => s + v.lat, 0) / group.length;
          const lng = group.reduce((s, v) => s + v.lng, 0) / group.length;
          const icon = L.divIcon({
            className: 'venue-pin',
            html: `<div class="venue-cluster-wrap"><div class="venue-cluster-circle">${group.length}</div></div>`,
            iconSize, iconAnchor,
          });
          const marker = L.marker([lat, lng], { icon, keyboard: false });
          marker.bindTooltip(
            `${group.length} ${t('map.venues')}`,
            { direction: 'top', offset: [0, -18] }
          );
          marker.on('click', () => {
            map.setView([lat, lng], Math.min(19, map.getZoom() + 3));
          });
          return marker;
        }

        const v = group[0];
        const meta = TYPE_META[v.type] || DEFAULT_TYPE_META;
        const isSelected = selectedVenueId != null && v.id === selectedVenueId;
        const showLabel = activeId != null && v.neighbourhood_id === activeId;

        const icon = L.divIcon({
          className: 'venue-pin',
          html: `
            <div class="venue-pin-wrap${isSelected ? ' selected' : ''}">
              <div class="venue-pin-circle" style="background:${meta.color}">
                <span class="venue-pin-emoji">${meta.emoji}</span>
              </div>
              ${showLabel ? `<div class="venue-pin-label">${escapeHtml(v.name)}</div>` : ''}
            </div>
          `,
          iconSize, iconAnchor,
        });
        const marker = L.marker([v.lat, v.lng], { icon, keyboard: false });

        const cheapest = v.beers?.[0];
        if (cheapest) {
          marker.bindTooltip(
            `${escapeHtml(v.name)} · ${formatEuro(cheapest.size_05, i18n.language)}`,
            { direction: 'top', offset: [0, -18] }
          );
        }
        marker.on('click', () => onVenueClick && onVenueClick(v));
        return marker;
      });

      markersLayerRef.current = L.layerGroup(markers).addTo(map);
    }

    buildMarkers();
    // Re-cluster on zoom — the same set of venues can be one overlapping
    // clump at city zoom and fully separated pins a few zoom levels in.
    map.on('zoomend', buildMarkers);
    return () => { map.off('zoomend', buildMarkers); };
  }, [venues, onVenueClick, i18n.language, activeId, selectedVenueId, t]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating tooltip */}
      <div ref={tooltipRef} className="map-tooltip-container" style={{ display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 1000 }} />

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-title">{t('map.legend.title')}</div>
        <div className="legend-bar">
          <div className="legend-gradient" />
          <div className="legend-labels">
            <span>€4.40</span>
            <span>€5.40</span>
            <span>€6.30+</span>
          </div>
        </div>
        <div className="legend-extremes">
          <span>{t('map.legend.cheap')}</span>
          <span>{t('map.legend.expensive')}</span>
        </div>
      </div>
    </div>
  );
}
