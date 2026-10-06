import { detectLang, tr } from "../i18n.js";
import { partsInTz, wallToEpoch } from "./tz.js";

export const SCHEMA_VERSION = 2;
export const DEFAULT_TZ = "America/New_York";
export const ACCOUNT_TYPES = ["LIVE", "PROP", "PAPER", "BACKTEST"];
export const UNITS = ["$", "%", "R"];

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeAccount(partial = {}) {
  return {
    id: newId(),
    name: tr("Mijn journal"),
    broker: tr("Handmatig"),
    type: "LIVE",
    startBalance: 10000,
    riskMode: "FIXED", // FIXED | COMPOUNDING
    riskUnit: "%", // % | $
    riskValue: 1,
    commission: 0, // per contract, round turn
    adjustments: [], // { id, date, amount, note } — stortingen (+) en opnames (−)
    ...partial,
  };
}

export function defaultSettings() {
  return { timezone: DEFAULT_TZ, unit: "$", period: "all", accountId: "all", lang: detectLang(), imports: [] };
}

// Geplande risico per trade in dollars, op het moment dat de trade wordt genomen.
export function riskDollars(account, balanceBefore) {
  const base = account.riskMode === "COMPOUNDING" ? balanceBefore : account.startBalance;
  const value = Number(account.riskValue) || 0;
  return account.riskUnit === "$" ? value : (base * value) / 100;
}

function adjustmentsUpTo(account, date) {
  return (account.adjustments || []).filter((a) => a.date <= date).reduce((s, a) => s + Number(a.amount || 0), 0);
}

// Verrijkt trades met afgeleide waarden: dag, uur, saldo en de waarde in $, % en R.
// Geeft een lijst terug die oplopend op sluitmoment is gesorteerd.
export function enrich(trades, accounts, tz) {
  const byAccount = new Map(accounts.map((a) => [a.id, a]));
  const grouped = new Map();
  for (const t of trades) {
    if (!byAccount.has(t.accountId)) continue;
    if (!grouped.has(t.accountId)) grouped.set(t.accountId, []);
    grouped.get(t.accountId).push(t);
  }

  const out = [];
  for (const [accountId, list] of grouped) {
    const account = byAccount.get(accountId);
    list.sort((a, b) => a.closedAt - b.closedAt || a.openedAt - b.openedAt);
    let cum = 0;
    for (const t of list) {
      const closeParts = partsInTz(t.closedAt, tz);
      const openParts = partsInTz(t.openedAt, tz);
      const balBefore = account.startBalance + adjustmentsUpTo(account, closeParts.date) + cum;
      const pnl = Number(t.pnl) || 0;
      const risk = riskDollars(account, balBefore);
      const base = account.riskMode === "COMPOUNDING" ? balBefore : account.startBalance;
      const r = t.r != null && t.r !== "" ? Number(t.r) : risk > 0 ? pnl / risk : null;
      cum += pnl;
      out.push({
        ...t,
        qty: Number(t.qty) || 1,
        day: closeParts.date,
        month: closeParts.month,
        dow: closeParts.dow,
        openHour: openParts.h,
        openHourFrac: openParts.hourFrac,
        balBefore,
        balAfter: balBefore + pnl,
        risk,
        v: { $: pnl, "%": base > 0 ? (pnl / base) * 100 : null, R: r },
      });
    }
  }
  out.sort((a, b) => a.closedAt - b.closedAt || a.openedAt - b.openedAt);
  return out;
}

// Zet oude "entries" (alleen resultaat in R) om naar het trade-model.
export function migrateEntries(entries, account, tz) {
  const ordered = [...entries].reverse(); // oude lijst staat nieuwste-eerst
  return ordered.map((e, i) => {
    const [y, mo, d] = String(e.date || "").split("-").map(Number);
    const ok = y && mo && d;
    const closedAt = ok ? wallToEpoch(y, mo, d, 12, 0, i % 60, tz) : Date.now();
    const r = Number(e.result);
    const price = (x) => (x === "" || x == null || Number.isNaN(Number(x)) ? null : Number(x));
    return {
      id: e.id,
      accountId: account.id,
      symbol: String(e.symbol || "").toUpperCase(),
      direction: e.direction === "Short" ? "Short" : "Long",
      qty: 1,
      entryPrice: price(e.entryPrice),
      exitPrice: price(e.exitPrice),
      openedAt: closedAt,
      closedAt,
      pnl: Number.isFinite(r) ? r * riskDollars(account, account.startBalance) : 0,
      fees: 0,
      r: Number.isFinite(r) ? r : null,
      setup: e.setup || "",
      mood: e.mood || "",
      lesson: e.lesson || "",
      positionSize: e.positionSize || "",
      hasScreenshot: !!e.hasScreenshot,
      source: "legacy",
    };
  });
}

export function tradeKey(t) {
  return [t.accountId, t.symbol, t.direction, t.qty, t.openedAt, t.closedAt, Number(t.pnl).toFixed(2)].join("|");
}
