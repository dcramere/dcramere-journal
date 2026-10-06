// Tijdzone-hulpjes op basis van Intl — geen externe dependency nodig.

const formatters = new Map();

function formatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function partsInTz(ms, tz) {
  const p = {};
  for (const x of formatter(tz).formatToParts(new Date(ms))) {
    if (x.type !== "literal") p[x.type] = x.value;
  }
  const y = +p.year;
  const mo = +p.month;
  const d = +p.day;
  const h = +p.hour % 24;
  return {
    y,
    mo,
    d,
    h,
    mi: +p.minute,
    s: +p.second,
    date: `${p.year}-${p.month}-${p.day}`,
    month: `${p.year}-${p.month}`,
    dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(),
    hourFrac: h + +p.minute / 60,
  };
}

function asUtc(p) {
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
}

// Wandelt een "wandkloktijd" in een tijdzone om naar epoch-milliseconden.
export function wallToEpoch(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = guess - (asUtc(partsInTz(guess, tz)) - guess);
  t = guess - (asUtc(partsInTz(t, tz)) - t);
  return t;
}

export function todayInTz(tz, now = Date.now()) {
  return partsInTz(now, tz).date;
}

export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return { y, mo: m, d };
}

export function addDays(dateStr, n) {
  const { y, mo, d } = parseDate(dateStr);
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

// Aantal werkdagen (ma-vr) na `from` t/m `to`.
export function marketDaysBetween(from, to) {
  if (to <= from) return 0;
  let count = 0;
  let cur = from;
  while (cur < to) {
    cur = addDays(cur, 1);
    const dow = new Date(`${cur}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

// Weken (zondag-eerst) voor een maand: arrays van 7 datumstrings of null.
export function monthMatrix(y, mo) {
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const total = daysInMonth(y, mo);
  const cells = [];
  for (let i = 0; i < first; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) {
    cells.push(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Paramaribo",
  "Europe/Amsterdam",
  "Europe/London",
  "UTC",
];
