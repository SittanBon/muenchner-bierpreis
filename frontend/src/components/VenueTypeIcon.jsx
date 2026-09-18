import { Beer, Trees, Utensils, Landmark } from 'lucide-react';

// Same four colours as the map pins (MunichMap.jsx's TYPE_META) — kept as a
// separate, intentionally duplicated map rather than importing MunichMap's
// own TYPE_META, since bar here is #92400e (a deep amber-brown filled-badge
// colour) rather than the map pin's current #d97706 border colour; the two
// surfaces read differently (a small solid badge next to text vs. a
// bordered circle sitting on a busy map), so they're allowed to diverge
// deliberately rather than being forced to share one source of truth.
const TYPE_CONFIG = {
  bar: { Icon: Beer, background: '#92400e' },
  beer_garden: { Icon: Trees, background: '#2d7a2d' },
  restaurant: { Icon: Utensils, background: '#5a3d1e' },
  beer_hall: { Icon: Landmark, background: '#7a4a06' },
};
const DEFAULT_CONFIG = TYPE_CONFIG.bar;

// A small filled circle with a centred white Lucide icon — the sidebar/
// detail-page equivalent of the map's own pin design. size is the circle's
// diameter in px; the icon itself stays at exactly half that (14px at the
// default 28px), matching the design spec's stated ratio, so a caller that
// renders this bigger (e.g. VenueDetail's hero icon) gets a proportionally
// bigger icon rather than a big flat circle with a tiny icon lost in it.
export default function VenueTypeIcon({ type, size = 28 }) {
  const { Icon, background } = TYPE_CONFIG[type] || DEFAULT_CONFIG;
  const iconSize = Math.round(size * 0.5);
  return (
    <span className="venue-type-icon" style={{ width: size, height: size, background }}>
      <Icon size={iconSize} color="#ffffff" strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
