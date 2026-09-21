import { useEffect, useState } from 'react';

// The current time, refreshed every `everyMs` while `enabled` — so anything derived from
// "now" (which venues are open) stays correct without a reload. Disabled = no timer.
export function useNow(everyMs = 60000, enabled = true) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs, enabled]);
  return now;
}
