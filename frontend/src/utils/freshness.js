// Price-freshness traffic light.
//   green  — confirmed less than 3 months ago
//   yellow — 3 to 6 months ago
//   red    — more than 6 months ago (or never / unknown)

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

export function priceFreshness(dateStr) {
  if (!dateStr) return { level: 'red', months: null };
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return { level: 'red', months: null };

  const months = (Date.now() - then) / MONTH_MS;
  if (months < 3) return { level: 'green', months };
  if (months < 6) return { level: 'yellow', months };
  return { level: 'red', months };
}

export const FRESHNESS_COLORS = {
  green: '#3a9d3a',
  yellow: '#d9a300',
  red: '#c8442c',
};

// i18n key suffix for each level (see translations `venue.freshness.*`).
export const FRESHNESS_KEY = {
  green: 'fresh',
  yellow: 'aging',
  red: 'stale',
};
