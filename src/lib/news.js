// Geplande Amerikaanse economische publicaties (tijden in New York, ET) voor de kalender, het nieuwsoverzicht en de statistiek per nieuwsdag.
//
// Bronnen: BLS (CPI, PPI, banenrapport), Federal Reserve (FOMC en notulen), BEA (GDP, PCE) en Census (retail sales).
// Opgehaald op 23 oktober 2026. Dekking:
//   - CPI, PPI, banenrapport en FOMC: heel 2026 en 2027;
//   - retail sales, GDP en PCE: vanaf oktober 2026 (GDP en PCE tot en met december 2026);
//   - ISM en de FOMC-notulen volgen een vaste regel en staan er daarom voor beide jaren in.
// De FOMC-data van 2027 zijn voorlopig. Voeg nieuwe jaren toe door de lijsten hieronder aan te vullen.

import { tr } from "../i18n.js";
import { groupStats } from "./metrics.js";
import { addDays } from "./tz.js";

export const NEWS_KINDS = {
  fomc: { label: "Fed-rentebesluit", short: "FOMC", time: "14:00" },
  minutes: { label: "Fed-notulen", short: "Minutes", time: "14:00" },
  cpi: { label: "CPI", short: "CPI", time: "08:30" },
  ppi: { label: "PPI", short: "PPI", time: "08:30" },
  jobs: { label: "Banenrapport", short: "Jobs", time: "08:30" },
  retail: { label: "Detailhandel", short: "Retail", time: "08:30" },
  gdpAdv: { label: "GDP (voorlopig)", short: "GDP", time: "08:30" },
  gdp: { label: "GDP", short: "GDP rev.", time: "08:30" },
  pce: { label: "PCE", short: "PCE", time: "08:30" },
  ismMfg: { label: "ISM Manufacturing", short: "ISM Mfg", time: "10:00" },
  ismSvc: { label: "ISM Services", short: "ISM Svc", time: "10:00" },
};

const CPI = [
  "2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10", "2026-05-12", "2026-06-10", "2026-07-14", "2026-08-12", "2026-09-11", "2026-10-14", "2026-11-10", "2026-12-10",
  "2027-01-13", "2027-02-11", "2027-03-10", "2027-04-13", "2027-05-12", "2027-06-10", "2027-07-14", "2027-08-11", "2027-09-14", "2027-10-14", "2027-11-10", "2027-12-10",
];
const PPI = [
  "2026-01-14", "2026-01-30", "2026-02-27", "2026-03-18", "2026-04-14", "2026-05-13", "2026-06-11", "2026-07-15", "2026-08-13", "2026-09-10", "2026-10-15", "2026-11-13", "2026-12-15",
  "2027-01-14", "2027-02-12", "2027-03-12", "2027-04-14", "2027-05-13", "2027-06-11", "2027-07-15", "2027-08-10", "2027-09-10", "2027-10-15", "2027-11-12", "2027-12-15",
];
const JOBS = [
  "2026-01-09", "2026-02-11", "2026-03-06", "2026-04-03", "2026-05-08", "2026-06-05", "2026-07-02", "2026-08-07", "2026-09-04", "2026-10-02", "2026-11-06", "2026-12-04",
  "2027-01-08", "2027-02-05", "2027-03-05", "2027-04-02", "2027-05-07", "2027-06-04", "2027-07-02", "2027-08-06", "2027-09-03", "2027-10-08", "2027-11-05", "2027-12-03",
];
const FOMC = [
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09", "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08",
];
const RETAIL = [
  "2026-10-15", "2026-11-17", "2026-12-16",
  "2027-01-15", "2027-02-17", "2027-03-16", "2027-04-16", "2027-05-14", "2027-06-16", "2027-07-16", "2027-08-16", "2027-09-16", "2027-10-15", "2027-11-16", "2027-12-15",
];
const GDP_ADV = ["2026-10-29"];
const GDP = ["2026-11-25", "2026-12-23"];
const PCE = ["2026-10-29", "2026-11-25", "2026-12-23"];

// Federale feestdagen waarop ISM niet publiceert.
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-10-11", "2027-11-11", "2027-11-25", "2027-12-24",
]);

const pad = (n) => String(n).padStart(2, "0");

const isBusinessDay = (date) => {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(date);
};

// n-de werkdag van de maand (1-gebaseerd): ISM Manufacturing is de 1e, ISM Services de 3e.
function nthBusinessDay(year, month, n) {
  let found = 0;
  for (let d = 1; d <= 31; d += 1) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    if (isBusinessDay(date)) {
      found += 1;
      if (found === n) return date;
    }
  }
  return null;
}

function build() {
  const byDate = new Map();
  const add = (date, id) => {
    if (!date) return;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(id);
  };
  CPI.forEach((d) => add(d, "cpi"));
  PPI.forEach((d) => add(d, "ppi"));
  JOBS.forEach((d) => add(d, "jobs"));
  FOMC.forEach((d) => {
    add(d, "fomc");
    add(addDays(d, 21), "minutes"); // de notulen komen drie weken na het besluit
  });
  RETAIL.forEach((d) => add(d, "retail"));
  GDP_ADV.forEach((d) => add(d, "gdpAdv"));
  GDP.forEach((d) => add(d, "gdp"));
  PCE.forEach((d) => add(d, "pce"));
  for (const year of [2026, 2027]) {
    for (let month = 1; month <= 12; month += 1) {
      add(nthBusinessDay(year, month, 1), "ismMfg");
      add(nthBusinessDay(year, month, 3), "ismSvc");
    }
  }
  const order = Object.keys(NEWS_KINDS);
  for (const ids of byDate.values()) ids.sort((a, b) => NEWS_KINDS[a].time.localeCompare(NEWS_KINDS[b].time) || order.indexOf(a) - order.indexOf(b));
  return byDate;
}

const BY_DATE = build();

export const newsName = (id) => tr(NEWS_KINDS[id].label);

// Korte naam voor smalle plekken, zoals de assen van een grafiek.
export const newsShort = (id) => NEWS_KINDS[id].short;

export const newsOn = (date) => BY_DATE.get(date) || [];

// Alle publicaties van `from` tot en met `to`, op volgorde: [{ date, id, time }].
export function newsBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) for (const id of newsOn(d)) out.push({ date: d, id, time: NEWS_KINDS[id].time });
  return out;
}

// Alle datums per soort, voor de statistiek per nieuwsdag.
export function newsDatesByKind() {
  const out = {};
  for (const [date, ids] of BY_DATE) for (const id of ids) (out[id] ||= new Set()).add(date);
  return out;
}

export const newsLastDate = () => [...BY_DATE.keys()].sort().at(-1);

// Resultaat per soort nieuwsdag. Een trade telt mee voor elke publicatie van die dag (CPI en PPI op dezelfde dag tellen beide).
export function newsDayStats(trades, unit) {
  const kinds = newsDatesByKind();
  const rows = [];
  for (const id of Object.keys(NEWS_KINDS)) {
    const dates = kinds[id];
    if (!dates) continue;
    const hit = trades.filter((t) => dates.has(t.day));
    if (!hit.length) continue;
    rows.push(...groupStats(hit, () => id, unit));
  }
  return rows.sort((a, b) => b.trades - a.trades);
}
