import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { neighbourhoodGeoJSON } from '../data/neighbourhoodGeoJSON';

// Price → colour scale (amber/brown tones — Bavarian feel)
function priceToColor(price, min = 4.40, max = 6.30) {
  const t = Math.max(0, Math.min(1, (price - min) / (max - min)));
  // Light amber (cheap) → deep amber-brown (expensive)
  const r = Math.round(255 - t * 60);
  const g = Math.round(200 - t * 110);
  const b = Math.round(80 - t * 60);
  return `rgb(${r},${g},${b})`;
}

export default function MunichMap({ neighbourhoods, venues, onNeighbourhoodClick, onVenueClick, activeId, highlight = false }) {
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
                    <div class="tt-price">Ø <strong>€${stat.avg.toFixed(2)}</strong></div>
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

  // Venue pins — one small amber/brown dot per venue with GPS coordinates. Rebuilt
  // whenever the (already filtered/searched) venue set changes so pins always match
  // the sidebar list. Kept in its own layer/effect from the neighbourhood polygons
  // so a search that narrows venues doesn't have to redraw the whole GeoJSON layer.
  useEffect(() => {
    if (!leafletMap.current) return;
    const L = window.L;

    if (markersLayerRef.current) markersLayerRef.current.remove();

    const pinIcon = L.divIcon({
      className: 'venue-pin',
      html: '<span class="venue-pin-dot"></span>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const markers = venues
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => {
        const marker = L.marker([v.lat, v.lng], { icon: pinIcon, keyboard: false });
        // Cheapest beer (beers[0] — the API already sorts ASC by price) plus how
        // many other brands this venue lists, e.g. "Augustiner €4.80 + 2 more".
        const cheapest = v.beers?.[0];
        const extra = (v.beers?.length || 0) - 1;
        const priceLine = cheapest
          ? `${cheapest.brand} €${cheapest.size_05.toFixed(2)}${extra > 0 ? ` + ${extra} more` : ''}`
          : '';
        marker.bindTooltip(
          `<div class="pin-tt-name">${v.name}</div>${priceLine ? `<div class="pin-tt-price">${priceLine}</div>` : ''}`,
          { direction: 'top', offset: [0, -6] }
        );
        marker.on('click', () => onVenueClick && onVenueClick(v));
        return marker;
      });

    markersLayerRef.current = L.layerGroup(markers).addTo(leafletMap.current);
  }, [venues, onVenueClick]);

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
