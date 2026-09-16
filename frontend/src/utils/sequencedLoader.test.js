import { describe, it, expect, vi } from 'vitest';
import { createSequencedLoader } from './sequencedLoader';

// Regression test for a real, reproduced bug: App.jsx's venue-filter fetch had
// no request sequencing, so on real-world variable network latency an EARLIER
// (now-stale) request could resolve AFTER a LATER one and silently overwrite
// the correct, current filter result with stale data — this is what produced
// "the type/max-price filter shows an active badge but the result list is
// wrong" reports. Confirmed live with Puppeteer by artificially delaying an
// intermediate request's response behind the final one; these tests cover
// the same shape of bug with controllable, deterministic promise timing.

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

describe('createSequencedLoader', () => {
  it('applies the result when only one call is in flight', async () => {
    const load = createSequencedLoader((x) => Promise.resolve(x * 2));
    await expect(load(5)).resolves.toBe(10);
  });

  it('ignores an earlier call that resolves AFTER a later one (out-of-order network)', async () => {
    const first = deferred();
    const second = deferred();
    const fetcher = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const load = createSequencedLoader(fetcher);

    const firstResult = load('stale-query');
    const secondResult = load('final-query');

    // The second (final) request's response arrives FIRST — exactly the
    // out-of-order scenario that broke filtering before this fix.
    second.resolve('final-data');
    first.resolve('stale-data');

    await expect(secondResult).resolves.toBe('final-data');
    // The superseded first call must resolve to undefined, not its stale
    // payload — the caller relies on this to know "don't apply this".
    await expect(firstResult).resolves.toBeUndefined();
  });

  it('always lets the most recently issued call win, regardless of arrival order', async () => {
    const calls = [deferred(), deferred(), deferred()];
    let i = 0;
    const fetcher = vi.fn(() => calls[i++].promise);
    const load = createSequencedLoader(fetcher);

    const results = [load('a'), load('b'), load('c')];

    // Resolve out of order: 3rd (final) first, then 1st, then 2nd.
    calls[2].resolve('c-data');
    calls[0].resolve('a-data');
    calls[1].resolve('b-data');

    const resolved = await Promise.all(results);
    expect(resolved).toEqual([undefined, undefined, 'c-data']);
  });

  it('propagates a rejection from the underlying fetcher', async () => {
    const load = createSequencedLoader(() => Promise.reject(new Error('network error')));
    await expect(load()).rejects.toThrow('network error');
  });
});
