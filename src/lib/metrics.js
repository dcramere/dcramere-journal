import { rootSymbol } from "./contracts.js";
import { marketDaysBetween } from "./tz.js";

const EPS = 1e-9;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const holdMs = (t) => (t.closedAt >= t.openedAt ? t.closedAt - t.openedAt : null);

// Samenvatting van een groep trades in de gekozen eenheid.
export function summarize(trades, unit) {
  const counted = trades.filter((t) => t.v[unit] != null);
  const vals = counted.map((t) => t.v[unit]);
  const wins = vals.filter((v) => v > EPS);
  const losses = vals.filter((v) => v < -EPS);
  const holds = trades.map(holdMs).filter((h) => h != null);
  return {
    trades: trades.length,
    counted: vals.length,
    wins: wins.length,
    losses: losses.length,
    be: vals.length - wins.length - losses.length,
    winRate: vals.length ? wins.length / vals.length : null,
    net: sum(vals),
    avgWin: mean(wins),
    avgLoss: losses.length ? Math.abs(mean(losses)) : null,
    avgHold: mean(holds),
    expectancy: vals.length ? sum(vals) / vals.length : null,
    grossWin: sum(wins),
    grossLoss: Math.abs(sum(losses)),
  };
}

export function groupStats(trades, keyFn, unit) {
  const map = new Map();
  for (const t of trades) {
    const k = keyFn(t);
    if (k == null || k === "") continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  }
  return [...map.entries()].map(([key, list]) => ({ key, ...summarize(list, unit) }));
}

function runs(flags) {
  // flags: array van 1 (winst), -1 (verlies), 0 (breakeven)
  const histogram = new Map();
  let longestWin = 0;
  let longestLoss = 0;
  let cur = 0;
  let curType = 0;
  const flush = () => {
    if (!curType) return;
    const entry = histogram.get(cur) || { won: 0, lost: 0 };
    if (curType === 1) entry.won += 1;
    else entry.lost += 1;
    histogram.set(cur, entry);
  };
  for (const f of flags) {
    if (f !== 0 && f === curType) {
      cur += 1;
    } else {
      flush();
      curType = f;
      cur = f === 0 ? 0 : 1;
    }
    if (curType === 1) longestWin = Math.max(longestWin, cur);
    if (curType === -1) longestLoss = Math.max(longestLoss, cur);
  }
  const current = { type: curType, len: cur };
  flush();
  return {
    longestWin,
    longestLoss,
    current,
    histogram: [...histogram.entries()].sort((a, b) => a[0] - b[0]).map(([len, c]) => ({ len, ...c })),
    winRuns: sum([...histogram.values()].map((c) => c.won)),
    lossRuns: sum([...histogram.values()].map((c) => c.lost)),
  };
}

// trades: verrijkte trades (zie model.enrich), oplopend gesorteerd.
export function computeStats(trades, unit, { startBalance = 0 } = {}) {
  const ts = trades.filter((t) => t.v[unit] != null);
  const v = (t) => t.v[unit];
  const base = summarize(ts, unit);

  const profitFactor = base.grossLoss > EPS ? base.grossWin / base.grossLoss : base.grossWin > EPS ? Infinity : null;
  const ratio = base.avgWin != null && base.avgLoss ? base.avgWin / base.avgLoss : null;
  const neededWinRate = ratio != null ? 1 / (1 + ratio) : null;
  const rValues = trades.map((t) => t.v.R).filter((x) => x != null);

  const winners = ts.filter((t) => v(t) > EPS);
  const losers = ts.filter((t) => v(t) < -EPS);
  const evens = ts.filter((t) => Math.abs(v(t)) <= EPS);
  const holds = (list) => mean(list.map(holdMs).filter((h) => h != null));

  // Dagen
  const dayMap = new Map();
  for (const t of ts) {
    if (!dayMap.has(t.day)) dayMap.set(t.day, []);
    dayMap.get(t.day).push(t);
  }
  const days = [...dayMap.keys()]
    .sort()
    .map((date) => {
      const list = dayMap.get(date);
      return {
        date,
        month: date.slice(0, 7),
        trades: list.length,
        value: sum(list.map(v)),
        wins: list.filter((t) => v(t) > EPS).length,
        losses: list.filter((t) => v(t) < -EPS).length,
        grossWin: sum(list.map(v).filter((x) => x > EPS)),
        grossLoss: Math.abs(sum(list.map(v).filter((x) => x < -EPS))),
        qty: sum(list.map((t) => t.qty)),
        avgQty: mean(list.map((t) => t.qty)),
        hasNote: list.some((t) => t.lesson),
      };
    });
  const dayVals = days.map((d) => d.value);
  const winDays = days.filter((d) => d.value > EPS);
  const lossDays = days.filter((d) => d.value < -EPS);

  // Opbouwende reeks per dag (voor de lijngrafieken)
  const series = [];
  let longestUnder = 0;
  {
    let n = 0;
    let w = 0;
    let l = 0;
    let gw = 0;
    let gl = 0;
    let cum = 0;
    let peak = unit === "$" ? startBalance : 0;
    let underDays = 0;
    for (const d of days) {
      for (const t of dayMap.get(d.date)) {
        const x = v(t);
        n += 1;
        if (x > EPS) {
          w += 1;
          gw += x;
        } else if (x < -EPS) {
          l += 1;
          gl += x;
        }
      }
      cum += d.value;
      const equity = (unit === "$" ? startBalance : 0) + cum;
      peak = Math.max(peak, equity);
      const dd = peak - equity;
      underDays = dd > EPS ? underDays + 1 : 0;
      longestUnder = Math.max(longestUnder, underDays);
      const avgWin = w ? gw / w : null;
      const avgLoss = l ? Math.abs(gl) / l : null;
      const r = avgWin != null && avgLoss ? avgWin / avgLoss : null;
      series.push({
        date: d.date,
        value: d.value,
        cum,
        equity,
        peak,
        dd,
        ddPct: peak > 0 && unit === "$" ? dd / peak : null,
        n,
        winRate: n ? w / n : null,
        avgWin,
        avgLoss,
        ratio: r,
        neededWinRate: r != null ? 1 / (1 + r) : null,
        neededRatio: n && w ? (1 - w / n) / (w / n) : null,
        expectancy: n ? cum / n : null,
        avgQty: d.avgQty,
      });
    }
  }
  const ddMax = series.reduce((m, s) => (s.dd > (m?.dd ?? -1) ? s : m), null);
  const ddPositive = series.filter((s) => s.dd > EPS);
  const last = series[series.length - 1];

  // Maanden
  const monthMap = new Map();
  for (const t of ts) {
    if (!monthMap.has(t.month)) monthMap.set(t.month, []);
    monthMap.get(t.month).push(t);
  }
  const months = [...monthMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, list]) => ({ month, ...summarize(list, unit) }));
  const bestMonth = months.reduce((m, x) => (!m || x.net > m.net ? x : m), null);
  const worstMonth = months.reduce((m, x) => (!m || x.net < m.net ? x : m), null);

  const flags = ts.map((t) => (v(t) > EPS ? 1 : v(t) < -EPS ? -1 : 0));
  const tradeRuns = runs(flags);
  const dayRuns = runs(days.map((d) => (d.value > EPS ? 1 : d.value < -EPS ? -1 : 0)));

  const byWeekday = groupStats(ts, (t) => t.dow, unit).sort((a, b) => a.key - b.key);
  const byHour = groupStats(ts, (t) => t.openHour, unit).sort((a, b) => a.key - b.key);
  const byContract = groupStats(ts, (t) => rootSymbol(t.symbol), unit).sort((a, b) => b.net - a.net);
  const bySide = groupStats(ts, (t) => t.direction, unit);
  const byMood = groupStats(ts, (t) => t.mood, unit).sort((a, b) => b.expectancy - a.expectancy);
  const bySetup = groupStats(ts, (t) => t.setup, unit).sort((a, b) => b.winRate - a.winRate);

  return {
    unit,
    ...base,
    profitFactor,
    ratio,
    neededWinRate,
    avgR: mean(rValues),
    largestWin: winners.length ? Math.max(...winners.map(v)) : null,
    largestLoss: losers.length ? Math.min(...losers.map(v)) : null,
    avgHoldWin: holds(winners),
    avgHoldLoss: holds(losers),
    avgHoldBe: holds(evens),
    longestHold: ts.length ? Math.max(0, ...ts.map((t) => holdMs(t) ?? 0)) : null,
    contracts: sum(ts.map((t) => t.qty)),
    tradingDays: days.length,
    tradesPerDay: days.length ? ts.length / days.length : null,
    contractsPerDay: days.length ? sum(ts.map((t) => t.qty)) / days.length : null,
    contractsPerTrade: ts.length ? sum(ts.map((t) => t.qty)) / ts.length : null,
    winDays: winDays.length,
    lossDays: lossDays.length,
    beDays: days.length - winDays.length - lossDays.length,
    notedDays: days.filter((d) => d.hasNote).length,
    avgDay: mean(dayVals),
    avgWinDay: mean(winDays.map((d) => d.value)),
    avgLossDay: mean(lossDays.map((d) => d.value)),
    bestDay: days.reduce((m, d) => (!m || d.value > m.value ? d : m), null),
    worstDay: days.length ? days.reduce((m, d) => (d.value < m.value ? d : m), days[0]) : null,
    days,
    series,
    months,
    bestMonth,
    worstMonth,
    avgMonth: mean(months.map((m) => m.net)),
    streaks: { ...tradeRuns, winDaysRow: dayRuns.longestWin, lossDaysRow: dayRuns.longestLoss },
    drawdown: {
      max: ddMax ? ddMax.dd : 0,
      maxPct: ddMax ? ddMax.ddPct : null,
      maxDate: ddMax && ddMax.dd > EPS ? ddMax.date : null,
      avg: ddPositive.length ? mean(ddPositive.map((s) => s.dd)) : 0,
      current: last ? last.dd : 0,
      longestUnder,
      atHigh: !last || last.dd <= EPS,
    },
    byWeekday,
    byHour,
    byContract,
    bySide,
    byMood,
    bySetup,
    holdPoints: ts.filter((t) => holdMs(t) != null).map((t) => ({ x: holdMs(t) / 60000, y: v(t), id: t.id })),
    timePoints: ts.map((t) => ({ x: t.openHourFrac, y: v(t), id: t.id })),
  };
}

// Saldo per handelsdag (altijd in dollars) plus markeringen voor stortingen/opnames.
export function balanceSeries(trades, accounts) {
  const dayPnl = new Map();
  for (const t of trades) dayPnl.set(t.day, (dayPnl.get(t.day) || 0) + (Number(t.pnl) || 0));
  const adj = accounts.flatMap((a) => (a.adjustments || []).map((x) => ({ ...x, accountName: a.name })));
  const dates = [...new Set([...dayPnl.keys(), ...adj.map((a) => a.date)])].sort();
  let bal = sum(accounts.map((a) => Number(a.startBalance) || 0));
  const points = [];
  for (const date of dates) {
    const pnl = dayPnl.get(date) || 0;
    const a = adj.filter((x) => x.date === date);
    const flow = sum(a.map((x) => Number(x.amount) || 0));
    bal += pnl + flow;
    points.push({ date, balance: bal, pnl, flow, hasAdjustment: a.length > 0 });
  }
  return { start: sum(accounts.map((a) => Number(a.startBalance) || 0)), points, end: bal };
}

// Groeitempo per marktdag, afgeleid van je eigen saldo-verloop.
export function growthStats(trades, accounts, today) {
  if (!trades.length) return null;
  const first = trades[0];
  const { start, points, end } = balanceSeries(trades, accounts);
  const from = first.day;
  const days = marketDaysBetween(from, today);
  const base = accounts.length === 1 ? first.balBefore : start;
  if (days < 1 || base <= 0 || end <= 0) return { days, perDay: null, balance: end, firstDay: from, base };

  // Tijdgewogen rendement: stortingen en opnames tellen niet mee als groei.
  let prev = start;
  let factor = 1;
  for (const p of points) {
    if (prev > 0) factor *= 1 + p.pnl / prev;
    prev += p.pnl + p.flow;
  }
  if (!(factor > 0)) return { days, perDay: null, balance: end, firstDay: from, base };
  const perDay = Math.pow(factor, 1 / days) - 1;
  return { days, perDay, balance: end, firstDay: from, base };
}

export function daysToTarget(growth, target) {
  if (!growth || growth.perDay == null || growth.perDay <= 0) return null;
  if (target <= growth.balance) return 0;
  return Math.log(target / growth.balance) / Math.log(1 + growth.perDay);
}

export function projectBalance(growth, years) {
  if (!growth || growth.perDay == null) return null;
  return growth.balance * Math.pow(1 + growth.perDay, 252 * years);
}

export function kelly(winRate, ratio) {
  if (winRate == null || ratio == null || ratio <= 0) return null;
  return winRate - (1 - winRate) / ratio;
}

function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function maxDrawdown(path) {
  let peak = path[0];
  let max = 0;
  for (const x of path) {
    peak = Math.max(peak, x);
    max = Math.max(max, peak - x);
  }
  return max;
}

export const MIN_TRADES_SIMULATION = 100;

// Herschikt je echte trades: het eindresultaat blijft gelijk, het pad en de drawdown niet.
export function monteCarlo(dollarValues, { sims = 1000, seed = 1348 } = {}) {
  const n = dollarValues.length;
  if (n < MIN_TRADES_SIMULATION) return null;
  const rnd = mulberry32(seed);
  const paths = [];
  const drawdowns = [];
  for (let s = 0; s < sims; s += 1) {
    const order = shuffled(dollarValues, rnd);
    let cum = 0;
    const path = [0];
    for (const x of order) {
      cum += x;
      path.push(cum);
    }
    paths.push(path);
    drawdowns.push(maxDrawdown(path));
  }
  const actualPath = [0];
  dollarValues.reduce((c, x) => {
    actualPath.push(c + x);
    return c + x;
  }, 0);
  const actualDd = maxDrawdown(actualPath);
  const bands = [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => {
    const out = [];
    for (let i = 0; i <= n; i += 1) {
      const col = paths.map((p) => p[i]).sort((a, b) => a - b);
      out.push(quantile(col, q));
    }
    return { q, values: out };
  });
  const sortedDd = drawdowns.slice().sort((a, b) => a - b);
  const worseCount = drawdowns.filter((d) => d <= actualDd).length;
  return {
    n,
    sims,
    actualPath,
    bands,
    actualDd,
    ddP50: quantile(sortedDd, 0.5),
    ddP95: quantile(sortedDd, 0.95),
    actualDdPercentile: worseCount / sims,
  };
}

// Kans dat een reeks van `horizon` trades (met teruglegging) je een bedrag `ruinAmount` kost.
export function riskOfRuin(dollarValues, ruinAmount, { horizon = 100, sims = 2000, seed = 2026 } = {}) {
  if (dollarValues.length < MIN_TRADES_SIMULATION || ruinAmount <= 0) return null;
  const rnd = mulberry32(seed);
  let ruined = 0;
  for (let s = 0; s < sims; s += 1) {
    let cum = 0;
    for (let i = 0; i < horizon; i += 1) {
      cum += dollarValues[Math.floor(rnd() * dollarValues.length)];
      if (cum <= -ruinAmount) {
        ruined += 1;
        break;
      }
    }
  }
  return { probability: ruined / sims, horizon, sims };
}
