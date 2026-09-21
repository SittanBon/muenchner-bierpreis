import { useCallback, useEffect, useRef, useState } from 'react';

// The browser's geolocation for "Günstiges Bier in der Nähe". The position is used
// only in the browser (distance filtering happens client-side) — it is never sent
// to the server.
//
//   status  'idle' | 'loading' | 'ok' | 'error'
//   coords  { lat, lng, accuracy } once status is 'ok', else null
//   reason  why it failed: 'denied' | 'unavailable' | 'timeout' | 'unsupported'
//
// request() returns a promise for the coords (or null on failure) so the caller can
// react at that moment — e.g. fly the map there — without an effect. A response that
// arrives after clear() or after a newer request() is ignored.
const OPTIONS = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };
const IDLE = { status: 'idle', coords: null, reason: null };

export function useNearby() {
  const [state, setState] = useState(IDLE);
  const ticket = useRef(0);

  useEffect(() => () => { ticket.current += 1; }, []); // no setState after unmount

  const request = useCallback(() => new Promise((resolve) => {
    const mine = ++ticket.current;
    const fail = (reason) => {
      if (mine !== ticket.current) return resolve(null);
      setState({ status: 'error', coords: null, reason });
      resolve(null);
    };
    if (typeof navigator === 'undefined' || !navigator.geolocation) return fail('unsupported');
    setState({ status: 'loading', coords: null, reason: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mine !== ticket.current) return resolve(null);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setState({ status: 'ok', coords, reason: null });
        resolve(coords);
      },
      (err) => fail(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'),
      OPTIONS,
    );
  }), []);

  const clear = useCallback(() => { ticket.current += 1; setState(IDLE); }, []);

  return { ...state, request, clear };
}
