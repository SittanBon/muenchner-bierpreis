// Wraps an async loader so that, when called repeatedly in quick succession,
// only the result of the MOST RECENTLY issued call is ever returned as "live"
// — every earlier, now-superseded call resolves to `undefined` instead.
//
// This exists to fix a real, reproduced bug: App.jsx's venue-filter fetch
// used to re-run on every filter/search change with no sequencing, so on
// real-world variable network latency an EARLIER (now-stale) request could
// resolve AFTER a LATER one and silently overwrite the correct, current
// result with wrong data — this is what caused "the max-price filter is
// ignored" / "the type filter shows an active badge but doesn't filter"
// reports: the badge and the input already reflected the latest selection,
// but a slower, stale response landed last and won the state update.
//
// Usage: const load = createSequencedLoader(fetchVenues);
//        const data = await load(params); // undefined if superseded before it resolved
export function createSequencedLoader(fetcher) {
  let seq = 0;
  return async (...args) => {
    const callId = ++seq;
    const result = await fetcher(...args);
    return callId === seq ? result : undefined;
  };
}
