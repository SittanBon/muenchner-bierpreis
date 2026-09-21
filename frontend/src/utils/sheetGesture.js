// Bottom-sheet geometry and drag physics, as pure functions (the DOM wiring is in
// hooks/useSheetDrag.js). The sheet has three resting stops — measured as how far
// it is translated DOWN from fully open — plus "dismiss":
//   full       0                 everything visible
//   half       46% of its height the venue card, map still visible above
//   collapsed  all but 120 px    a peek: venue name + price
export const PEEK_PX = 120;
export const HALF_RATIO = 0.46;
export const STOPS = ['full', 'half', 'collapsed']; // top -> bottom
const FLICK_SPEED = 0.6;   // px/ms — faster than this is a flick, whatever the distance
const DISMISS_SLACK = 48;  // px dragged past the collapsed stop = let go of the sheet

export function stopOffsets(height, peek = PEEK_PX) {
  const half = Math.round(height * HALF_RATIO);
  return { full: 0, half, collapsed: Math.max(height - peek, half + 1) };
}

// Where the sheet ends up after a drag that started at `level` and moved `dy` px
// (positive = down) leaving at `velocity` px/ms (positive = down).
// Returns 'full' | 'half' | 'collapsed' | 'dismiss'.
export function resolveDrop({ level, dy, height, velocity = 0 }) {
  const stops = stopOffsets(height);
  const position = Math.max(0, stops[level] + dy);
  const index = STOPS.indexOf(level);

  // Dragged clearly below the peek, or flicked down while already at the peek.
  if (position > stops.collapsed + DISMISS_SLACK) return 'dismiss';
  if (level === 'collapsed' && velocity > FLICK_SPEED && dy > 0) return 'dismiss';

  // A flick moves exactly one stop in its direction.
  if (Math.abs(velocity) > FLICK_SPEED && dy !== 0) {
    const next = index + (velocity > 0 ? 1 : -1);
    return STOPS[Math.min(STOPS.length - 1, Math.max(0, next))];
  }

  // Otherwise the nearest stop wins.
  return STOPS.reduce((best, s) => (Math.abs(position - stops[s]) < Math.abs(position - stops[best]) ? s : best), STOPS[0]);
}

// A tap (no drag) on the handle: collapsed -> half -> full -> half.
export function nextLevelOnTap(level) {
  if (level === 'collapsed') return 'half';
  if (level === 'half') return 'full';
  return 'half';
}
