import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

// Dialog focus management, in two independent parts:
//   * `open`  — while the dialog exists: focus moves INTO it when it opens (the container must be
//               focusable, tabIndex={-1}), and goes BACK to whatever opened it when it closes. If
//               that element is gone (e.g. a map marker that was rebuilt) `fallback()` supplies one.
//   * `trap`  — while true, Tab / Shift+Tab cycle inside the container and cannot leave it.
//               (The venue sheet's collapsed "peek" leaves the map usable, so it turns the trap off.)
//   * `onEscape` (optional) — called on Escape, except while focus is in a form field (there Escape
//               belongs to the field and must not throw away what was typed).
export function useFocusTrap(containerRef, { open, trap = open, fallback, onEscape }) {
  const triggerRef = useRef(null);
  const fallbackRef = useRef(fallback);
  const escapeRef = useRef(onEscape);
  useEffect(() => { fallbackRef.current = fallback; escapeRef.current = onEscape; });

  useEffect(() => {
    if (!open || !onEscape) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.target?.closest?.('input, textarea, select')) return;
      escapeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onEscape]);

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement;
    containerRef.current?.focus({ preventScroll: true });
    return () => {
      const t = triggerRef.current;
      const target = t && t !== document.body && document.contains(t) ? t : fallbackRef.current?.();
      target?.focus?.({ preventScroll: true });
    };
  }, [open, containerRef]);

  useEffect(() => {
    if (!open || !trap) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const el = containerRef.current;
      if (!el) return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter(isVisible);
      if (items.length === 0) { e.preventDefault(); el.focus(); return; }
      const first = items[0]; const last = items[items.length - 1];
      const active = document.activeElement;
      if (!el.contains(active)) { e.preventDefault(); first.focus(); }            // focus escaped: pull it back
      else if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, trap, containerRef]);
}
