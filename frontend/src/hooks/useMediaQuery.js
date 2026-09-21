import { useSyncExternalStore } from 'react';

// Live `window.matchMedia(query).matches` (no effect/setState — React subscribes to
// the media query itself). Server/first paint without matchMedia reads as false.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

// Everything below the 1024px desktop layout: single column, bottom nav, bottom sheet.
export const useIsMobileLayout = () => useMediaQuery('(max-width: 1023px)');
