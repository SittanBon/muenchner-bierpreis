import { useRef, useEffect } from 'react';

// Tiny static Leaflet preview — its own map instance, unrelated to the main
// MunichMap, torn down on unmount. Used by the "missing a bar?" confirmation
// step and the admin queue's new-venue submission cards.
export default function MiniMapPreview({ lat, lng, className = 'mini-map-preview' }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !window.L || lat == null || lng == null) return;
    const L = window.L;
    mapRef.current = L.map(ref.current, {
      center: [lat, lng], zoom: 16, zoomControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false, attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19 }).addTo(mapRef.current);
    const icon = L.divIcon({ className: 'venue-pin', html: '<span class="venue-pin-dot"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker([lat, lng], { icon }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [lat, lng]);

  if (lat == null || lng == null) return null;
  return <div ref={ref} className={className} />;
}
