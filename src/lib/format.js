import { getLang } from "../i18n.js";

const MINUS = "−";

const loc = () => (getLang() === "en" ? "en-US" : "nl-NL");

export function money(v, { sign = false, dec = 2 } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const body = abs.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const isZero = Number(abs.toFixed(dec)) === 0;
  if (v < 0 && !isZero) return `${MINUS}$${body}`;
  return `${sign && !isZero ? "+" : ""}$${body}`;
}

export function fixed(v, dec = 2, { sign = false } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : `${MINUS}∞`;
  const abs = Math.abs(v).toFixed(dec);
  const isZero = Number(abs) === 0;
  if (v < 0 && !isZero) return `${MINUS}${abs}`;
  return `${sign && !isZero ? "+" : ""}${abs}`;
}

// Waarde in de gekozen eenheid: "$", "%" of "R".
export function unitValue(v, unit, { sign = false, dec = 2 } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  if (unit === "$") return money(v, { sign, dec });
  if (unit === "%") return `${fixed(v, dec, { sign })}%`;
  return `${fixed(v, dec, { sign })}R`;
}

export function pct(v, dec = 0) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(dec)}%`;
}

export function duration(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const hourUnit = getLang() === "en" ? "h" : "u";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}${hourUnit} ${rest}m` : `${h}${hourUnit}`;
}

export function axisValue(v, unit) {
  const abs = Math.abs(v);
  const sgn = v < 0 ? MINUS : "";
  if (unit === "$") {
    if (abs >= 1000) return `${sgn}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return `${sgn}$${abs.toFixed(abs < 10 && abs % 1 !== 0 ? 1 : 0)}`;
  }
  if (unit === "%") return `${sgn}${abs.toFixed(abs < 10 && abs % 1 !== 0 ? 1 : 0)}%`;
  return `${sgn}${abs.toFixed(abs < 10 && abs % 1 !== 0 ? 1 : 0)}R`;
}

export function timeLabel(ms, tz) {
  return new Intl.DateTimeFormat(loc(), {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

export function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(loc(), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// "maandag 3 augustus 2026" -> "3 augustus 2026" (weekdag eraf).
export function dateOnlyLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(loc(), { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function shortDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(loc(), { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
}

const utc = (opts, date) => new Intl.DateTimeFormat(loc(), { timeZone: "UTC", ...opts }).format(date);

// i = 0..11
export const monthShort = (i) => utc({ month: "short" }, new Date(Date.UTC(2023, i, 1))).replace(".", "").toUpperCase();
export const monthLong = (i) => utc({ month: "long" }, new Date(Date.UTC(2023, i, 1)));
// i = 0..6, zondag eerst
export const weekdayShort = (i) => utc({ weekday: "short" }, new Date(Date.UTC(2023, 0, 1 + i))).replace(".", "").toUpperCase();
export const weekdayShort2 = (i) => weekdayShort(i).slice(0, 2);
export const weekdayLong = (i) => utc({ weekday: "long" }, new Date(Date.UTC(2023, 0, 1 + i)));

// "vandaag", "gisteren", "3 dagen geleden" — op dagniveau.
export function relativeDay(ms) {
  if (ms == null) return "—";
  const days = Math.round((Date.now() - ms) / 86400000);
  return new Intl.RelativeTimeFormat(loc(), { numeric: "auto" }).format(-days, "day");
}

export function dateTimeLabel(ms) {
  return new Intl.DateTimeFormat(loc(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}
