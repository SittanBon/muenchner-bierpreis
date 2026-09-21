import { useCallback, useRef } from 'react';
import { stopOffsets, resolveDrop, nextLevelOnTap } from '../utils/sheetGesture';

// Drag behaviour for the mobile bottom sheet. Attach `handleProps` to the handle and
// `sheetRef` to the sheet. While a finger is down the sheet follows it (inline
// height, no transition); on release the pure `resolveDrop` picks a stop or
// "dismiss", the sheet glides there, and the app's state (`level`) takes over.
// A press without movement is a tap (cycles the stops).
//
//   level      'collapsed' | 'half' | 'full' — the current resting stop
//   onLevel    called with the new stop
//   onDismiss  called (after the slide-out) when the sheet is swiped away
const MOVE_THRESHOLD = 6; // px before a press counts as a drag

export function useSheetDrag({ level, onLevel, onDismiss }) {
  const sheetRef = useRef(null);
  const drag = useRef(null);

  // The sheet's full height comes from CSS (--sheet-full: everything between the header
  // and the bottom nav); measure it with a throw-away probe rather than duplicating the math.
  const fullHeight = () => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:var(--sheet-full)';
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  };

  // Glide to a VISIBLE height (px). The inline height is dropped once the class-based
  // height for the new stop has taken over (they are the same value, so nothing jumps).
  const settle = (el, visiblePx) => {
    el.style.transition = '';
    el.style.height = `${Math.max(0, visiblePx)}px`;
    window.setTimeout(() => { el.style.height = ''; }, 320);
  };

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = sheetRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false, height: fullHeight() };
  }, []);

  const onPointerMove = useCallback((e) => {
    const d = drag.current; const el = sheetRef.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) < MOVE_THRESHOLD) return;
    d.moved = true;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = 0.7 * d.v + 0.3 * ((e.clientY - d.lastY) / dt); // smoothed px/ms, + = down
    d.lastY = e.clientY; d.lastT = e.timeStamp;
    const start = stopOffsets(d.height)[level];          // how far DOWN from fully open
    const offset = Math.min(d.height, Math.max(0, start + dy));
    el.style.transition = 'none';
    el.style.height = `${d.height - offset}px`;          // visible height = full - offset
  }, [level]);

  const finish = useCallback((e, cancelled) => {
    const d = drag.current; const el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    if (!d.moved) { // a tap
      if (!cancelled) onLevel(nextLevelOnTap(level));
      return;
    }
    const outcome = resolveDrop({ level, dy: e.clientY - d.y0, height: d.height, velocity: d.v });
    if (outcome === 'dismiss') {
      settle(el, 0); // slide the rest of the way out, then let go of it
      window.setTimeout(onDismiss, 220);
    } else {
      onLevel(outcome);
      settle(el, d.height - stopOffsets(d.height)[outcome]);
    }
  }, [level, onLevel, onDismiss]);

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e) => finish(e, false),
    onPointerCancel: (e) => finish(e, true),
  };
  return { sheetRef, handleProps };
}
