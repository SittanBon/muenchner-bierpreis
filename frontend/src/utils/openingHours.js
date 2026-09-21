// "Jetzt geöffnet" — decided ONLY from opening hours we actually hold, and only when they
// are simple enough to read without guessing. The stored text is free-form ("Mo–So
// 17:00–1:00", "Mo, Do–So 6:30–1:00", "Mo–Fr 11:00–3:00, Sa–So 12:00–3:00"); anything
// else — "saisonal" or other notes in parentheses, open-ended "ab 10:00", garbage — is
// UNKNOWN, never a guess. isOpenNow returns true, false, or null (unknown); a caller
// must never turn null into "open" or "closed".
const DAY_INDEX = { So: 0, Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6 };
const DAY = '(?:Mo|Di|Mi|Do|Fr|Sa|So)';
const DASH = '[–-]';
const DAYS_ONLY = new RegExp(`^(${DAY})(?:${DASH}(${DAY}))?$`);
const FULL = new RegExp(`^(${DAY})(?:${DASH}(${DAY}))?\\s+(\\d{1,2}):(\\d{2})${DASH}(\\d{1,2}):(\\d{2})$`);

function expandDays(from, to) {
  const start = DAY_INDEX[from];
  if (!to) return [start];
  const end = DAY_INDEX[to];
  const days = [];
  for (let d = start; ; d = (d + 1) % 7) { days.push(d); if (d === end) break; }
  return days;
}
const minutes = (h, m) => Number(h) * 60 + Number(m);
const validTime = (h, m) => Number(h) <= 24 && Number(m) < 60 && !(Number(h) === 24 && Number(m) > 0);

// -> [{ days: number[], from: minutes, to: minutes }] or null when not understood.
export function parseOpeningHours(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  if (/[()]/.test(text)) return null; // seasonal / conditional notes: hours are not reliable
  const pieces = text.trim().split(/\s*,\s*/);
  const rules = [];
  let carried = []; // days named without a time ("Mo, Do–So 6:30–1:00" -> Mo joins the next piece)
  for (const piece of pieces) {
    const only = DAYS_ONLY.exec(piece);
    if (only) { carried.push(...expandDays(only[1], only[2])); continue; }
    const m = FULL.exec(piece);
    if (!m) return null;
    if (!validTime(m[3], m[4]) || !validTime(m[5], m[6])) return null;
    const from = minutes(m[3], m[4]);
    const to = minutes(m[5], m[6]);
    if (from === to) return null;
    rules.push({ days: [...carried, ...expandDays(m[1], m[2])], from, to });
    carried = [];
  }
  if (carried.length || rules.length === 0) return null;
  return rules;
}

// The current weekday (0 = Sunday) and minute of day in Munich.
export function berlinParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
  return { day, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

// true / false when the stored hours can be read, null when they cannot (or are absent).
// A rule that runs past midnight (17:00–1:00) is still open after midnight on the NEXT day.
export function isOpenNow(text, now = new Date()) {
  const rules = parseOpeningHours(text);
  if (!rules) return null;
  const { day, minute } = berlinParts(now);
  const yesterday = (day + 6) % 7;
  return rules.some((r) => {
    const wraps = r.to <= r.from;
    if (r.days.includes(day) && minute >= r.from && (wraps || minute < r.to)) return true;
    return wraps && r.days.includes(yesterday) && minute < r.to;
  });
}
