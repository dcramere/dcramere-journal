import { tr } from "../i18n.js";
import { pointValue, rootSymbol } from "./contracts.js";
import { newId } from "./model.js";
import { wallToEpoch } from "./tz.js";

// ---------- Parsing ----------

export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function indexer(headers) {
  const map = new Map(headers.map((h, i) => [norm(h), i]));
  return (...names) => {
    for (const n of names) {
      if (map.has(norm(n))) return map.get(norm(n));
    }
    return -1;
  };
}

export function parseMoney(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s.replace(/[$\s]/g, ""))) negative = true;
  s = s.replace(/[$,\s()]/g, "");
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = true;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseTimestamp(raw, tz) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s) && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (m) {
    let h = Number(m[4]);
    if (m[7]) {
      const pm = m[7].toUpperCase() === "PM";
      h = (h % 12) + (pm ? 12 : 0);
    }
    return wallToEpoch(Number(m[3]), Number(m[1]), Number(m[2]), h, Number(m[5]), Number(m[6] || 0), tz);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    return wallToEpoch(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0), tz);
  }
  return null;
}

// ---------- Importeren ----------

function baseTrade(accountId, fields) {
  return {
    id: newId(),
    accountId,
    setup: "",
    mood: "",
    lesson: "",
    hasScreenshot: false,
    fees: 0,
    r: null,
    ...fields,
  };
}

function applyFees(trade, commission) {
  const fees = (Number(commission) || 0) * (Number(trade.qty) || 0);
  return { ...trade, fees, pnl: trade.pnl - fees };
}

function fromPerformance(rows, idx, { accountId, tz, commission }) {
  const col = {
    symbol: idx("symbol", "contract"),
    qty: idx("qty", "quantity"),
    buy: idx("buyPrice"),
    sell: idx("sellPrice"),
    pnl: idx("pnl", "p&l"),
    bought: idx("boughtTimestamp"),
    sold: idx("soldTimestamp"),
  };
  const trades = [];
  const warnings = [];
  rows.forEach((r, i) => {
    const bought = parseTimestamp(r[col.bought], tz);
    const sold = parseTimestamp(r[col.sold], tz);
    const pnl = parseMoney(r[col.pnl]);
    if (bought == null || sold == null || pnl == null) {
      warnings.push(tr("Rij {n} overgeslagen (tijd of P&L ontbreekt).", { n: i + 2 }));
      return;
    }
    const long = bought <= sold;
    const buy = parseMoney(r[col.buy]);
    const sell = parseMoney(r[col.sell]);
    const trade = baseTrade(accountId, {
      symbol: String(r[col.symbol] || "").trim().toUpperCase(),
      direction: long ? "Long" : "Short",
      qty: Math.abs(Number(r[col.qty])) || 1,
      entryPrice: long ? buy : sell,
      exitPrice: long ? sell : buy,
      openedAt: Math.min(bought, sold),
      closedAt: Math.max(bought, sold),
      pnl,
      source: "csv",
    });
    trades.push(applyFees(trade, commission));
  });
  return { trades, warnings, format: "Tradovate performance" };
}

function fromOrders(rows, idx, { accountId, tz, commission }) {
  const col = {
    side: idx("bs", "side", "buysell", "action"),
    contract: idx("contract", "symbol"),
    qty: idx("filledQty", "filled qty", "fillqty", "qty", "quantity"),
    price: idx("avgFillPrice", "avgPrice", "fillPrice", "price"),
    time: idx("fillTime", "timestamp", "time", "date"),
    status: idx("status"),
    account: idx("account"),
  };
  const fills = [];
  const warnings = [];
  rows.forEach((r, i) => {
    if (col.status >= 0 && !/fill/i.test(r[col.status] || "")) return;
    const q = Math.abs(Number(String(r[col.qty]).replace(/,/g, "")));
    const price = parseMoney(r[col.price]);
    const time = parseTimestamp(r[col.time], tz);
    const side = String(r[col.side] || "").trim().toLowerCase();
    if (!q || price == null || time == null || !side) {
      if (r[col.status]) warnings.push(tr("Rij {n} overgeslagen (onvolledige fill).", { n: i + 2 }));
      return;
    }
    fills.push({
      key: `${col.account >= 0 ? r[col.account] : ""}|${String(r[col.contract]).trim().toUpperCase()}`,
      symbol: String(r[col.contract]).trim().toUpperCase(),
      q: side.startsWith("b") ? q : -q,
      price,
      time,
    });
  });
  fills.sort((a, b) => a.time - b.time);

  const trades = [];
  const unknown = new Set();
  const state = new Map();
  const fresh = () => ({ lots: [], realized: 0, entryQty: 0, entrySum: 0, exitQty: 0, exitSum: 0, openedAt: 0, dir: "Long", fills: 0 });

  for (const f of fills) {
    if (!state.has(f.key)) state.set(f.key, fresh());
    let s = state.get(f.key);
    const mult = pointValue(f.symbol);
    if (mult == null) unknown.add(rootSymbol(f.symbol));
    let q = f.q;
    const emit = () => {
      const avgEntry = s.entrySum / s.entryQty;
      const avgExit = s.exitQty ? s.exitSum / s.exitQty : null;
      const trade = baseTrade(accountId, {
        symbol: f.symbol,
        direction: s.dir,
        qty: s.entryQty,
        entryPrice: avgEntry,
        exitPrice: avgExit,
        openedAt: s.openedAt,
        closedAt: f.time,
        pnl: mult == null ? 0 : s.realized,
        fills: s.fills,
        source: "csv",
      });
      trades.push(applyFees(trade, commission));
      s = fresh();
      state.set(f.key, s);
    };
    s.fills += 1;
    while (q !== 0) {
      if (!s.lots.length) {
        s.dir = q > 0 ? "Long" : "Short";
        s.openedAt = f.time;
      }
      const head = s.lots[0];
      if (head && Math.sign(head.q) !== Math.sign(q)) {
        const m = Math.min(Math.abs(head.q), Math.abs(q));
        const points = head.q > 0 ? f.price - head.price : head.price - f.price;
        s.realized += points * m * (mult ?? 0);
        s.exitQty += m;
        s.exitSum += f.price * m;
        head.q -= Math.sign(head.q) * m;
        q -= Math.sign(q) * m;
        if (head.q === 0) s.lots.shift();
        if (!s.lots.length) {
          emit();
          if (q !== 0) s.fills = 1;
        }
      } else {
        s.lots.push({ price: f.price, q });
        s.entryQty += Math.abs(q);
        s.entrySum += f.price * Math.abs(q);
        q = 0;
      }
    }
  }
  const open = [...state.values()].filter((s) => s.lots.length).length;
  if (open) warnings.push(tr("{n} positie(s) nog open in het bestand; die zijn niet geïmporteerd.", { n: open }));
  if (unknown.size) {
    warnings.push(tr("Onbekend contract ({c}): P&L staat op $0 — pas die zelf aan in de trade.", { c: [...unknown].join(", ") }));
  }
  return { trades, warnings, format: "Tradovate orders" };
}

function fromOwnExport(rows, idx, { accountId, tz }) {
  const col = {
    opened: idx("opened"),
    closed: idx("closed"),
    symbol: idx("symbol"),
    direction: idx("direction"),
    qty: idx("qty"),
    entry: idx("entry"),
    exit: idx("exit"),
    fees: idx("fees"),
    pnl: idx("pnl"),
    r: idx("r"),
    setup: idx("setup"),
    mood: idx("mood"),
    lesson: idx("lesson"),
  };
  const trades = [];
  const warnings = [];
  rows.forEach((r, i) => {
    const opened = parseTimestamp(r[col.opened], tz);
    const closed = parseTimestamp(r[col.closed], tz) ?? opened;
    const pnl = parseMoney(r[col.pnl]);
    if (opened == null || closed == null || pnl == null) {
      warnings.push(tr("Rij {n} overgeslagen (tijd of P&L ontbreekt).", { n: i + 2 }));
      return;
    }
    const fees = parseMoney(r[col.fees]) ?? 0;
    trades.push(
      baseTrade(accountId, {
        symbol: String(r[col.symbol] || "").trim().toUpperCase(),
        direction: /short/i.test(r[col.direction] || "") ? "Short" : "Long",
        qty: Math.abs(Number(r[col.qty])) || 1,
        entryPrice: parseMoney(r[col.entry]),
        exitPrice: parseMoney(r[col.exit]),
        openedAt: Math.min(opened, closed),
        closedAt: Math.max(opened, closed),
        pnl,
        fees,
        r: parseMoney(r[col.r]),
        setup: r[col.setup] || "",
        mood: r[col.mood] || "",
        lesson: r[col.lesson] || "",
        source: "csv",
      })
    );
  });
  return { trades, warnings, format: "DCRAMERE export" };
}

// Herkent het bestandstype aan de kolomnamen en geeft trades terug.
export function importCsv(text, options) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error(tr("Het bestand bevat geen rijen."));
  const headers = rows[0];
  const idx = indexer(headers);
  const body = rows.slice(1);
  if (idx("boughtTimestamp") >= 0 && idx("soldTimestamp") >= 0) return fromPerformance(body, idx, options);
  if (idx("opened") >= 0 && idx("closed") >= 0 && idx("pnl") >= 0) return fromOwnExport(body, idx, options);
  if ((idx("bs", "side") >= 0 && idx("contract", "symbol") >= 0) && (idx("filledQty", "qty") >= 0)) {
    return fromOrders(body, idx, options);
  }
  throw new Error(
    tr("Onbekend bestandsformaat. Gevonden kolommen: {c}", { c: `${headers.slice(0, 12).join(", ")}${headers.length > 12 ? "…" : ""}` })
  );
}

// ---------- Exporteren ----------

const EXPORT_HEADERS = [
  "account",
  "opened",
  "closed",
  "symbol",
  "direction",
  "qty",
  "entry",
  "exit",
  "fees",
  "pnl",
  "r",
  "setup",
  "mood",
  "lesson",
];

function esc(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoWall(ms, tz) {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
  return p.replace(" ", "T");
}

export function exportCsv(trades, accounts, tz) {
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const lines = [EXPORT_HEADERS.join(",")];
  for (const t of trades) {
    lines.push(
      [
        names.get(t.accountId) || "",
        isoWall(t.openedAt, tz),
        isoWall(t.closedAt, tz),
        t.symbol,
        t.direction,
        t.qty,
        t.entryPrice ?? "",
        t.exitPrice ?? "",
        t.fees ?? 0,
        Number(t.pnl).toFixed(2),
        t.r ?? "",
        t.setup,
        t.mood,
        t.lesson,
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}
