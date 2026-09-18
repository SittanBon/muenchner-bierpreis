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

// Lucide icon path data (24x24 viewBox, stroke-based) copied verbatim from
// lucide-icons/lucide's own SVG source rather than approximated by hand, so
// these render identically to the real "beer"/"trees"/"utensils"/"landmark"
// icons — just the <path> markup, wrapped into a full <svg> by svgIcon()
// below so the outer element (and its currentColor / size) stays one place.
const TYPE_ICON_PATHS = {
  bar: `<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>`,
  beer_garden: `<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>`,
  restaurant: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
  beer_hall: `<path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>`,
};
function svgIcon(type) {
  const paths = TYPE_ICON_PATHS[type] || TYPE_ICON_PATHS.bar;
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// One colour per venue type, shared by the pin border and its icon.
const TYPE_META = {
  beer_garden: { color: '#2d7a2d' },
  beer_hall: { color: '#7a4a06' },
  bar: { color: '#e8a020' },
  restaurant: { color: '#5a3d1e' },
};
const DEFAULT_TYPE_META = { color: '#e8a020' };

// A white circle, coloured border, and centred Lucide icon — createVenueIcon
// returns a ready-to-use L.divIcon, no Leaflet state involved, so it's a
// pure function of (venue, isSelected) and safe to call for every marker on
// every rebuild. The icon itself is inline SVG (not a raster image), so it's
// pixel-sharp at any DPI/zoom with no @2x asset needed.
function createVenueIcon(venue, isSelected, showLabel, iconSize, iconAnchor) {
  const meta = TYPE_META[venue.type] || DEFAULT_TYPE_META;
  return window.L.divIcon({
    className: 'venue-pin',
    html: `
      <div class="venue-pin-wrap${isSelected ? ' selected' : ''}">
        <div class="venue-pin-circle" style="--pin-color:${meta.color}">
          ${svgIcon(venue.type)}
        </div>
        ${showLabel ? `<div class="venue-pin-label">${escapeHtml(venue.name)}</div>` : ''}
      </div>
    `,
    iconSize, iconAnchor,
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Same 768px breakpoint the rest of the app's CSS already switches the
// sidebar into a bottom sheet at — checked fresh on every pin click (not
// cached in state) so it stays correct across a resize/rotate mid-session.
function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

// The small popup card shown above a pin on desktop click. Built as a real
// DOM node (not an HTML string handed to Leaflet) so "View details →" gets a
// plain addEventListener instead of inline-onclick string-escaping tricks —
// venue names can contain quotes/HTML-ish characters, textContent sidesteps
// that entirely instead of needing escapeHtml everywhere in here too.
function buildVenuePopupContent(v, { t, i18n, onViewDetails }) {
  const meta = TYPE_META[v.type] || DEFAULT_TYPE_META;
  const cheapest = v.beers?.[0];

  const card = document.createElement('div');
  card.className = 'venue-popup-card';

  const header = document.createElement('div');
  header.className = 'vpc-header';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'vpc-icon';
  iconWrap.style.color = meta.color;
  iconWrap.innerHTML = svgIcon(v.type); // trusted, hardcoded Lucide markup only
  const name = document.createElement('span');
  name.className = 'vpc-name';
  name.textContent = v.name;
  header.appendChild(iconWrap);
  header.appendChild(name);
  card.appendChild(header);

  const metaLine = document.createElement('div');
  metaLine.className = 'vpc-meta';
  const neighbourhoodName = i18n.language === 'de' ? v.neighbourhood_name_de : v.neighbourhood_name_en;
  metaLine.textContent = [t(`filters.types.${v.type}`), neighbourhoodName].filter(Boolean).join(' · ');
  card.appendChild(metaLine);

  if (cheapest) {
    const priceLine = document.createElement('div');
    priceLine.className = 'vpc-price-line';
    const price = document.createElement('span');
    price.className = 'vpc-price';
    price.textContent = formatEuro(cheapest.size_05, i18n.language);
    priceLine.appendChild(price);
    if (cheapest.brand) {
      priceLine.appendChild(document.createTextNode(' · '));
      const brand = document.createElement('span');
      brand.className = 'vpc-brand';
      brand.textContent = cheapest.brand;
      priceLine.appendChild(brand);
    }
    card.appendChild(priceLine);
  }

  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'vpc-link';
  link.textContent = `${t('map.viewDetails')} →`;
  link.addEventListener('click', (e) => {
    e.stopPropagation();
    onViewDetails();
  });
  card.appendChild(link);

  return card;
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

    // Single source of truth for a polygon's style, keyed by (id, hover/active
    // state) — both the initial `style:` callback below AND the imperative
    // mouseover/mouseout handlers call this exact function, so they can never
    // drift out of sync again. (They previously did: the style callback capped
    // hover fillOpacity at 0.25, but mouseover hardcoded 0.72 — a dark, opaque
    // overlay that covered the map tiles underneath, directly contradicting
    // this function's own "stay subtle" intent.)
    //
    // Overlays stay subtle at all times so the map tiles/street names/landmarks
    // underneath always read clearly — a light fill tint plus the border
    // colour/weight does the feedback work, never a dark opaque wash.
    function neighbourhoodStyle(id, stat, isActiveNow, isHoveredNow) {
      const hasFilteredData = !!stat;
      // When a search is running, ring the neighbourhoods that still have
      // matches — its own distinct state, only shown when neither hovered nor
      // active (hover/active still take priority, same as before).
      const isMatch = highlight && hasFilteredData;

      if (isActiveNow) {
        return { fillColor: hasFilteredData ? priceToColor(stat.avg) : '#d4cfc8', fillOpacity: 0.25, color: '#3d2200', weight: 3, dashArray: null };
      }
      if (isHoveredNow) {
        return { fillColor: hasFilteredData ? priceToColor(stat.avg) : '#d4cfc8', fillOpacity: 0.20, color: '#7a4a06', weight: 2.5, dashArray: hasFilteredData ? null : '4 4' };
      }
      if (isMatch) {
        return { fillColor: priceToColor(stat.avg), fillOpacity: 0.22, color: '#c88010', weight: 3, dashArray: null };
      }
      return { fillColor: hasFilteredData ? priceToColor(stat.avg) : '#d4cfc8', fillOpacity: 0.12, color: '#b87310', weight: 1.5, dashArray: hasFilteredData ? null : '4 4' };
    }

    layerRef.current = L.geoJSON(neighbourhoodGeoJSON, {
      style: (feature) => {
        const id = feature.properties.id;
        const stat = filteredStats[id];
        return neighbourhoodStyle(id, stat, activeId === id, hoveredId === id);
      },
      onEachFeature: (feature, layer) => {
        const id = feature.properties.id;
        const nInfo = statsById[id];
        const stat = filteredStats[id];
        const name = i18n.language === 'de' ? nInfo?.name_de : nInfo?.name_en;

        layer.on({
          mouseover: () => {
            setHoveredId(id);
            layer.setStyle(neighbourhoodStyle(id, stat, activeId === id, true));

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
            layer.setStyle(neighbourhoodStyle(id, stat, activeId === id, false));
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
  //
  // Desktop click opens a small popup card above the pin (built fresh as a
  // one-off L.popup — never marker.bindPopup — so there's no automatic
  // click→openPopup wiring left registered on the marker to fight with the
  // mobile branch below). The popup-open "selected" ring is toggled directly
  // on that marker's own DOM node via the popup's 'remove' event rather than
  // through React state, so opening/closing a popup never triggers a full
  // marker-layer rebuild (which would destroy the very popup just opened).
  // selectedVenueId (the venue open in the sidebar/bottom sheet) still drives
  // isSelected the normal way, through the effect's own dependency below.
  useEffect(() => {
    if (!leafletMap.current) return;
    const L = window.L;
    const map = leafletMap.current;

    // A 44x44 icon box is the actual click/touch target on every screen size
    // (comfortably clears the 44x44 mobile minimum) — the visible circle
    // inside is styled smaller (36px desktop / 42px mobile) and centred
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
        const isSelected = selectedVenueId != null && v.id === selectedVenueId;
        const showLabel = activeId != null && v.neighbourhood_id === activeId;

        const icon = createVenueIcon(v, isSelected, showLabel, iconSize, iconAnchor);
        const marker = L.marker([v.lat, v.lng], { icon, keyboard: false });

        const cheapest = v.beers?.[0];
        if (cheapest) {
          marker.bindTooltip(
            `${escapeHtml(v.name)} · ${formatEuro(cheapest.size_05, i18n.language)}`,
            { direction: 'top', offset: [0, -18] }
          );
        }

        marker.on('click', () => {
          if (isMobileViewport()) {
            // Spec: skip the popup entirely on mobile, straight to the
            // bottom sheet (identical to this app's behaviour before pins
            // had a popup at all).
            onVenueClick && onVenueClick(v);
            return;
          }

          const content = buildVenuePopupContent(v, {
            t, i18n,
            onViewDetails: () => {
              map.closePopup();
              onVenueClick && onVenueClick(v);
            },
          });
          const popup = L.popup({
            closeButton: false, // spec: dismiss only by clicking elsewhere on the map
            offset: [0, -20],
            className: 'venue-popup',
            maxWidth: 240,
            autoPan: true,
          }).setLatLng([v.lat, v.lng]).setContent(content);

          // openOn() goes through the map's normal popup bookkeeping — the
          // same auto-close-previous / close-on-map-click behaviour a
          // marker.bindPopup() would get, without ever binding one.
          popup.openOn(map);

          const pinWrap = marker.getElement()?.querySelector('.venue-pin-wrap');
          if (pinWrap) {
            pinWrap.classList.add('selected');
            popup.on('remove', () => pinWrap.classList.remove('selected'));
          }
        });
        return marker;
      });

      markersLayerRef.current = L.layerGroup(markers).addTo(map);
    }

    buildMarkers();
    // Re-cluster on zoom — the same set of venues can be one overlapping
    // clump at city zoom and fully separated pins a few zoom levels in.
    map.on('zoomend', buildMarkers);
    return () => { map.off('zoomend', buildMarkers); };
  }, [venues, onVenueClick, i18n, i18n.language, activeId, selectedVenueId, t]);

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
