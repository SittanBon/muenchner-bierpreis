import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { neighbourhoodGeoJSON } from '../data/neighbourhoodGeoJSON';
import { formatEuro } from '../utils/price';
import { describePrice } from '../utils/priceUtils';
import { pillModel, pillText, TYPE_COLORS, DEFAULT_TYPE_COLOR } from '../utils/markerModel';
import { freshnessText, getFreshness } from '../utils/freshness';
import { priceAria } from '../utils/venueView';
import { priceLevel, levelLabel } from '../constants/priceLevels';
import MapLegend from './MapLegend';
import { clusterVenuesByPixel, separatingZoom, PILL_SIZE_MOBILE, PILL_SIZE_DESKTOP } from '../utils/clusterVenues';

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

// Venue-type colours live in utils/markerModel.js (the pill's left border). The
// popup card still shows the type's Lucide icon in the same colour.
const TYPE_META = Object.fromEntries(Object.entries(TYPE_COLORS).map(([k, color]) => [k, { color }]));
const DEFAULT_TYPE_META = { color: DEFAULT_TYPE_COLOR };

// PRICE-FIRST marker: a white pill whose text is the venue's ACTUAL headline price
// ("€4.20", or "€3.50·0.33L" when the serving size isn't 0.5 L), with a left border
// in the venue-type colour and a background tint for how fresh the price is.
// Stale/unknown prices also carry a "!" / "?" so freshness is never colour alone.
// The pill is centred on the venue's coordinates (zero-size icon box, CSS centres
// it); the touch target is enlarged to 44px in CSS. Built from plain data
// (utils/markerModel.js), so it is a pure function of (venue, language).
function createPillIcon(venue, model, showLabel) {
  return window.L.divIcon({
    className: 'price-pill-anchor',
    html: `
      <div class="price-pill${model.hasPrice ? '' : ' no-price'}" style="--pp-type:${model.typeColor};--pp-bg:${model.tint}" data-freshness="${model.state}">
        <span class="pp-text">${escapeHtml(pillText(model))}</span>${model.glyph ? `<span class="pp-glyph" aria-hidden="true">${model.glyph}</span>` : ''}
        ${showLabel ? `<span class="price-pill-label">${escapeHtml(venue.name)}</span>` : ''}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// The accessible name of a marker: everything the pill shows, in words.
function pinLabel(venue, model, t, lang) {
  const beer = venue.beers?.[0];
  const fresh = beer ? freshnessText(getFreshness(beer)) : null;
  // name, the price as a sentence ("4,20 Euro für 0,5 Liter" — or "…, Größe unbekannt"), freshness in words
  return [venue.name, model.hasPrice ? priceAria(beer, lang) : null, fresh ? t(fresh.key, { count: fresh.count }) : null].filter(Boolean).join(', ');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The same breakpoint the CSS switches to the single-column layout (bottom nav +
// bottom sheet) at, i.e. everything below the 1024px desktop layout — checked fresh
// on every pin click (not cached in state) so it stays correct across a resize/rotate.
function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
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
    // Actual menu price first; the serving size sits right beside it, and the
    // per-0.5 L comparison (only when the size is known and isn't 0.5 L) goes
    // on its own muted line below — never presented as what the guest pays.
    const p = describePrice(cheapest, i18n.language);
    price.textContent = p.actual;
    priceLine.appendChild(price);
    if (!p.isReferenceSize) {
      const size = document.createElement('span');
      size.className = 'vpc-size';
      size.textContent = ` ${p.sizeUnknown ? t('price.sizeUnknown') : p.volumeLabel}`;
      priceLine.appendChild(size);
    }
    if (cheapest.brand) {
      priceLine.appendChild(document.createTextNode(' · '));
      const brand = document.createElement('span');
      brand.className = 'vpc-brand';
      brand.textContent = cheapest.brand;
      priceLine.appendChild(brand);
    }
    card.appendChild(priceLine);
    if (p.normalized) {
      const approx = document.createElement('div');
      approx.className = 'vpc-approx';
      approx.textContent = t('price.approxPer05', { price: p.normalized });
      card.appendChild(approx);
    }
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
const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Leaflet makes a marker focusable (keyboard:true) but does NOT turn Enter into a click — its keyboard
// support only opens a bound popup, and ours have none. So Enter and Space activate a marker here,
// exactly like a tap: they fire the marker's own 'click' handler.
function activateOnKey(marker) {
  marker.on('keydown', (e) => {
    const k = e.originalEvent;
    if (!k || (k.key !== 'Enter' && k.key !== ' ')) return;
    k.preventDefault(); // Space must not scroll the page
    marker.fire('click', { originalEvent: k });
  });
}
const isDesktopViewport = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
// Desktop pills are 32px tall (mobile 28px), so they collide a little sooner.
const pillSize = () => (isDesktopViewport() ? PILL_SIZE_DESKTOP : PILL_SIZE_MOBILE);

export default function MunichMap({
  neighbourhoods, venues, onNeighbourhoodClick, onVenueClick, onVenueFocus, activeId, selectedVenueId,
  highlightId = null, highlight = false, userLocation = null, viewCommand = null, onUserMoved,
}) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const layerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [hoveredId, setHoveredId] = useState(null);

  // The marker layer must NOT be rebuilt just because a parent re-render handed us a
  // new function identity (that used to re-create every marker on every App state
  // change). Callbacks, `t` and the selection live in refs; only the venue set, the
  // zoom, the language and the focused neighbourhood rebuild the markers, and a change
  // of selection/hover only toggles a CSS class on the two pills involved.
  const onVenueClickRef = useRef(onVenueClick);
  const onVenueFocusRef = useRef(onVenueFocus);
  const tRef = useRef(t);
  const selectedRef = useRef(selectedVenueId);
  const highlightRef = useRef(highlightId);
  const popupVenueRef = useRef(null); // venue whose desktop popup is open
  const pendingViewRef = useRef(null); // a fly-to that arrived while the map had no size
  const venuesRef = useRef(venues);
  const onUserMovedRef = useRef(onUserMoved);
  const gestureAt = useRef(0);          // last time the USER touched the map
  const programmaticUntil = useRef(0);  // our own flyTo / pan is running until then
  const lastView = useRef(null);
  const pinsRef = useRef(new Map());  // venue id -> Leaflet marker
  useEffect(() => {
    onVenueClickRef.current = onVenueClick;
    onVenueFocusRef.current = onVenueFocus;
    tRef.current = t;
    venuesRef.current = venues;
    onUserMovedRef.current = onUserMoved;
  });

  // selected (open in the panel/popup) = stronger outline + larger + on top;
  // hover (row hovered in the list) = a lighter emphasis.
  const applyPinStates = useCallback(() => {
    pinsRef.current.forEach((marker, id) => {
      const pill = marker.getElement()?.querySelector('.price-pill');
      if (!pill) return;
      const selected = id === selectedRef.current || id === popupVenueRef.current;
      const hover = !selected && id === highlightRef.current;
      pill.classList.toggle('selected', selected);
      pill.classList.toggle('is-hover', hover);
      marker.setZIndexOffset(selected ? 1000 : hover ? 500 : 0);
    });
  }, []);

  useEffect(() => {
    if (leafletMap.current || !mapRef.current) return;

    const L = window.L;
    leafletMap.current = L.map(mapRef.current, {
      center: [48.145, 11.578],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
      // prefers-reduced-motion: no zoom/fade/marker animation at all
      ...(prefersReducedMotion() ? { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false } : {}),
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

    // "Search this area": tell the app when the USER moved or zoomed the map. Resizes
    // (tab switch, sheet opening — invalidateSize fires moveend too) and our own flyTo /
    // pan must not count, so a move only counts when a user gesture (touch, wheel,
    // keys, zoom buttons, drag end) happened just before it and our own animation is not running.
    const gestureEl = mapRef.current;
    const markGesture = () => { gestureAt.current = Date.now(); };
    ['pointerdown', 'touchstart', 'wheel', 'keydown', 'dblclick'].forEach((ev) => gestureEl.addEventListener(ev, markGesture, { passive: true }));
    leafletMap.current.on('dragend', markGesture);
    lastView.current = { c: leafletMap.current.getCenter(), z: leafletMap.current.getZoom() };
    leafletMap.current.on('moveend', () => {
      const m = leafletMap.current;
      if (!m) return;
      const prev = lastView.current;
      const view = { c: m.getCenter(), z: m.getZoom() };
      lastView.current = view;
      const now = Date.now();
      if (now < programmaticUntil.current || now - gestureAt.current > 3000) return;
      if (prev && view.z === prev.z && m.distance(view.c, prev.c) < 25) return;
      const b = m.getBounds();
      onUserMovedRef.current?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    });

    // The map's box changes without a window resize when the Karte/Liste tab flips,
    // the bottom sheet moves or a banner appears above it — keep Leaflet's size in sync.
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const m = leafletMap.current;
          if (!m) return;
          m.invalidateSize();
          const size = m.getSize();
          if (pendingViewRef.current && size.x > 0 && size.y > 0) {
            const { lat, lng, zoom } = pendingViewRef.current;
            pendingViewRef.current = null;
            programmaticUntil.current = Date.now() + 2500;
            m.setView([lat, lng], zoom);
          }
        })
      : null;
    resizeObserver?.observe(mapRef.current);

    return () => {
      ['pointerdown', 'touchstart', 'wheel', 'keydown', 'dblclick'].forEach((ev) => gestureEl.removeEventListener(ev, markGesture));
      resizeObserver?.disconnect();
      leafletMap.current?.remove();
      leafletMap.current = null;
      layerRef.current = null;
      markersLayerRef.current = null;
      userLayerRef.current = null;
      pinsRef.current = new Map();
    };
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
      // Shading compares per-0.5 L prices; a venue with no known serving size is left out.
      const nv = venues.filter(v => v.neighbourhood_id === n.id && v.beers[0]?.normalized_500ml_price != null);
      if (nv.length) {
        const avg = nv.reduce((s, v) => s + v.beers[0].normalized_500ml_price, 0) / nv.length;
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
      // The fill is the price LEVEL of the neighbourhood's average per-0.5 L price
      // (constants/priceLevels.js — the same table the legend reads); grey without data.
      // The levels are pastel, so the fill is stronger than the old amber wash; the
      // border keeps the amber identity and carries hover/active/search-match states.
      const fillColor = priceLevel(hasFilteredData ? stat.avg : null).color;
      // When a search is running, ring the neighbourhoods that still have
      // matches — its own distinct state, only shown when neither hovered nor
      // active (hover/active still take priority, same as before).
      const isMatch = highlight && hasFilteredData;
      const dashArray = hasFilteredData ? null : '4 4';

      if (isActiveNow) return { fillColor, fillOpacity: 0.75, color: '#3d2200', weight: 3, dashArray: null };
      if (isHoveredNow) return { fillColor, fillOpacity: 0.7, color: '#7a4a06', weight: 2.5, dashArray };
      if (isMatch) return { fillColor, fillOpacity: 0.65, color: '#c88010', weight: 3, dashArray: null };
      return { fillColor, fillOpacity: 0.55, color: '#b87310', weight: 1.5, dashArray };
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
                    <div class="tt-level">${levelLabel(priceLevel(stat.avg), i18n.language)}</div>
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

  // Venue markers — one price pill per venue with GPS coordinates (pills that would
  // overlap on screen at the current zoom collapse into one numbered cluster instead
  // of silently stacking, which would leave everything but the topmost unclickable).
  // Kept in its own layer/effect from the neighbourhood polygons so a search that
  // narrows venues doesn't redraw the whole GeoJSON layer. Tapping a pill never moves
  // the map; tapping a CLUSTER zooms in, since that is what separates its pills.
  //
  // Desktop click opens a small popup card above the pill (a one-off L.popup, never
  // marker.bindPopup, so no automatic click→openPopup wiring is left to fight with the
  // mobile branch). Mobile skips the popup and goes straight to the bottom sheet.
  // Keyboard: every marker is focusable and Enter activates it (Leaflet turns Enter
  // into a click); the aria-label spells out name, price and freshness.
  useEffect(() => {
    if (!leafletMap.current) return;
    const L = window.L;
    const map = leafletMap.current;
    const lang = i18n.language;
    const hoverCapable = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;

    // A 44x44 icon box is the touch target of a CLUSTER; a pill's own 44px-tall touch
    // target is done in CSS around its (centred) zero-size anchor.
    const clusterIconSize = [44, 44];
    const clusterIconAnchor = [22, 22];

    function buildMarkers() {
      const tt = tRef.current;
      if (markersLayerRef.current) markersLayerRef.current.remove();
      pinsRef.current = new Map();

      const markers = clusterVenuesByPixel((ll, z) => map.project(ll, z), venues, map.getZoom(), pillSize()).map((group) => {
        if (group.length > 1) {
          const lat = group.reduce((sum, v) => sum + v.lat, 0) / group.length;
          const lng = group.reduce((sum, v) => sum + v.lng, 0) / group.length;
          const icon = L.divIcon({
            className: 'venue-pin',
            html: `<div class="venue-cluster-wrap"><div class="venue-cluster-circle">${group.length}</div></div>`,
            iconSize: clusterIconSize, iconAnchor: clusterIconAnchor,
          });
          const marker = L.marker([lat, lng], { icon, keyboard: true });
          activateOnKey(marker);
          marker.on('add', () => marker.getElement()?.setAttribute('aria-label', tt('map.clusterLabel', { count: group.length })));
          if (hoverCapable) marker.bindTooltip(`${group.length} ${tt('map.venues')}`, { direction: 'top', offset: [0, -18] });
          marker.on('click', () => {
            map.setView([lat, lng], Math.min(19, map.getZoom() + 3));
          });
          return marker;
        }

        const v = group[0];
        const showLabel = activeId != null && v.neighbourhood_id === activeId;
        const model = pillModel(v, lang);
        const marker = L.marker([v.lat, v.lng], { icon: createPillIcon(v, model, showLabel), keyboard: true });
        activateOnKey(marker);
        const label = pinLabel(v, model, tt, lang);
        marker.on('add', () => marker.getElement()?.setAttribute('aria-label', label));
        pinsRef.current.set(v.id, marker);

        if (hoverCapable && v.beers?.[0]) {
          const tp = describePrice(v.beers[0], lang);
          const sizeNote = tp.isReferenceSize ? '' : ` (${tp.sizeUnknown ? tt('price.sizeUnknown') : tp.volumeLabel})`;
          marker.bindTooltip(`${escapeHtml(v.name)} · ${tp.actual}${escapeHtml(sizeNote)}`, { direction: 'top', offset: [0, -22] });
        }

        marker.on('click', () => {
          onVenueFocusRef.current?.(v); // keep the list row in step with the marker
          if (isMobileViewport()) {
            onVenueClickRef.current?.(v); // straight to the bottom sheet
            return;
          }

          const content = buildVenuePopupContent(v, {
            t: tt, i18n,
            onViewDetails: () => {
              map.closePopup();
              onVenueClickRef.current?.(v);
            },
          });
          const popup = L.popup({
            closeButton: false, // dismiss only by clicking elsewhere on the map
            offset: [0, -20],
            className: 'venue-popup',
            maxWidth: 240,
            autoPan: true,
          }).setLatLng([v.lat, v.lng]).setContent(content);

          popup.openOn(map);
          popupVenueRef.current = v.id;
          applyPinStates();
          popup.on('remove', () => {
            if (popupVenueRef.current === v.id) popupVenueRef.current = null;
            applyPinStates();
          });
        });
        return marker;
      });

      markersLayerRef.current = L.layerGroup(markers).addTo(map);
      applyPinStates();
    }

    buildMarkers();
    // Re-cluster on zoom — the same set of venues can be one overlapping
    // clump at city zoom and fully separated pills a few zoom levels in.
    map.on('zoomend', buildMarkers);
    return () => { map.off('zoomend', buildMarkers); };
  }, [venues, i18n, i18n.language, activeId, applyPinStates]);

  // Selection / list-hover changes only toggle classes — no marker is rebuilt.
  useEffect(() => {
    selectedRef.current = selectedVenueId;
    highlightRef.current = highlightId;
    applyPinStates();
  }, [selectedVenueId, highlightId, applyPinStates]);

  // A venue is picked (a list card, a stats tile, a marker's "details"): bring it into view AND make
  // sure its own pill exists to be highlighted — a venue inside a cluster has none. So zoom in just far
  // enough for it to stand alone (never zooming out), then
  //  * desktop: the map centres on it;
  //  * mobile: once the bottom sheet has settled, pan it into the middle of the map area that stays
  //    VISIBLE above the sheet (the selected marker must never end up hidden behind it).
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || selectedVenueId == null) return undefined;
    const v = venuesRef.current.find((x) => x.id === selectedVenueId);
    if (!v || v.lat == null || v.lng == null) return undefined;
    const reduce = prefersReducedMotion();
    programmaticUntil.current = Date.now() + 2500; // our own move — not a user pan
    const zoom = separatingZoom(v, venuesRef.current, (ll, z) => map.project(ll, z), map.getZoom(), { size: pillSize() });

    if (!isMobileViewport()) {
      map.setView([v.lat, v.lng], zoom, { animate: !reduce });
      return undefined;
    }
    if (zoom !== map.getZoom()) map.setView([v.lat, v.lng], zoom, { animate: false });
    const timer = setTimeout(() => {
      const sheet = document.querySelector('.pub-panel--detail');
      if (!map || !sheet || !mapRef.current) return;
      map.invalidateSize();
      const box = mapRef.current.getBoundingClientRect();
      const visibleH = sheet.getBoundingClientRect().top - box.top;
      if (visibleH < 80) return;
      const pt = map.latLngToContainerPoint([v.lat, v.lng]);
      programmaticUntil.current = Date.now() + 2500;
      map.panBy([pt.x - box.width / 2, pt.y - visibleH / 2], { animate: !reduce });
    }, 450); // after the sheet's slide-in has settled
    return () => clearTimeout(timer);
  }, [selectedVenueId]);

  // The user's position ("Günstiges Bier in der Nähe"): a dot plus a soft accuracy
  // circle — only when the browser really gave us coordinates.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const L = window.L;
    if (userLayerRef.current) { userLayerRef.current.remove(); userLayerRef.current = null; }
    if (!userLocation) return;
    const parts = [];
    if (userLocation.accuracy && userLocation.accuracy < 1000) {
      parts.push(L.circle([userLocation.lat, userLocation.lng], { radius: userLocation.accuracy, className: 'user-accuracy', interactive: false }));
    }
    const icon = L.divIcon({ className: 'user-dot-anchor', html: '<div class="user-dot"></div>', iconSize: [0, 0], iconAnchor: [0, 0] });
    const dot = L.marker([userLocation.lat, userLocation.lng], { icon, interactive: false, keyboard: false, zIndexOffset: 2000 });
    dot.on('add', () => dot.getElement()?.setAttribute('aria-label', tRef.current('nearby.you')));
    parts.push(dot);
    userLayerRef.current = L.layerGroup(parts).addTo(map);
  }, [userLocation]);

  // "Fly to me" / "show Munich": the app hands over a one-off command object.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !viewCommand) return;
    const { lat, lng, zoom } = viewCommand;
    // A map with no size (its container is hidden) can't compute a view — Leaflet
    // would throw "Invalid LatLng (NaN, NaN)". Queue it; the resize observer applies it.
    map.invalidateSize();
    const size = map.getSize();
    if (!size.x || !size.y) { pendingViewRef.current = viewCommand; return; }
    programmaticUntil.current = Date.now() + 2500; // our own move — not a user pan
    if (prefersReducedMotion()) map.setView([lat, lng], zoom);
    else map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [viewCommand]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating tooltip */}
      <div ref={tooltipRef} className="map-tooltip-container" style={{ display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 1000 }} />

      <MapLegend />
    </div>
  );
}
