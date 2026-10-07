// Tests voor de rekenlaag (statistieken, CSV, tijdzones, migratie).  npm run test:lib
import { makeAccount, enrich, migrateEntries } from "../src/lib/model.js";
import { computeStats, balanceSeries, growthStats, daysToTarget, projectBalance, kelly, monteCarlo, riskOfRuin } from "../src/lib/metrics.js";
import { importCsv, exportCsv, parseMoney } from "../src/lib/csv.js";
import { wallToEpoch, partsInTz, marketDaysBetween } from "../src/lib/tz.js";
import { rootSymbol, pointValue } from "../src/lib/contracts.js";
import { buildReport, isoWeekKey, lastCompletedPeriods, previousPeriod } from "../src/lib/report.js";

let fails = 0;
const eq = (name, got, want, tol = 0.005) => {
  const pass = typeof want === "number" ? Math.abs(got - want) <= tol : got === want;
  if (!pass) fails += 1;
  console.log(pass ? "ok  " : "FAIL", name, pass ? "" : `got: ${got} want: ${want}`);
};
const TZ = "America/New_York";

const t1 = wallToEpoch(2026, 10, 6, 10, 31, 0, TZ);
const p1 = partsInTz(t1, TZ);
eq("tz roundtrip", `${p1.date} ${p1.h}:${p1.mi}`, "2026-10-06 10:31");
eq("tz after DST", partsInTz(wallToEpoch(2026, 3, 9, 9, 30, 0, TZ), TZ).h, 9);
eq("rootSymbol MNQZ6", rootSymbol("MNQZ6"), "MNQ");
eq("rootSymbol ESH26", rootSymbol("ESH26"), "ES");
eq("rootSymbol BTCUSDT", rootSymbol("BTCUSDT"), "BTCUSDT");
eq("pointValue MNQZ6", pointValue("MNQZ6"), 2);
eq("parseMoney paren", parseMoney("$(52.00)"), -52);
eq("parseMoney plain", parseMoney("$1,234.50"), 1234.5);
eq("market days Oct1->Oct6", marketDaysBetween("2026-10-01", "2026-10-06"), 3);

// Dataset met bekende totalen: 16 trades, 13 winst, +418, PF 1.68, expectancy 26.12.
const account = makeAccount({ name: "Test", type: "PROP", startBalance: 25000, riskUnit: "$", riskValue: 100 });
const rows = [
  ["2026-10-01", "10:35", 47], ["2026-10-02", "10:40", -249], ["2026-10-02", "10:43", -312], ["2026-10-02", "10:57", 702],
  ["2026-10-05", "09:23", 18], ["2026-10-05", "09:48", 11], ["2026-10-05", "10:10", 8], ["2026-10-05", "10:17", 16],
  ["2026-10-05", "10:35", 32], ["2026-10-05", "11:08", 35], ["2026-10-05", "12:24", -52], ["2026-10-05", "12:35", 12],
  ["2026-10-05", "12:50", 10], ["2026-10-06", "10:31", 96.5], ["2026-10-06", "11:08", 16.5], ["2026-10-06", "11:42", 27],
];
const trades = rows.map(([d, tm, pnl], i) => {
  const [y, m, dd] = d.split("-").map(Number);
  const [h, mi] = tm.split(":").map(Number);
  const open = wallToEpoch(y, m, dd, h, mi, 0, TZ);
  return { id: "t" + i, accountId: account.id, symbol: "MNQ", direction: "Long", qty: i % 3 === 0 ? 4 : 2, openedAt: open, closedAt: open + 60000, pnl, fees: 0, r: null, setup: "", mood: "", lesson: "" };
});
const en = enrich(trades, [account], TZ);
const s = computeStats(en, "$", { startBalance: 25000 });
eq("trades", s.trades, 16);
eq("net", s.net, 418);
eq("winRate", s.winRate, 13 / 16, 1e-9);
eq("avgWin", s.avgWin, 79.31);
eq("avgLoss", s.avgLoss, 204.33);
eq("ratio", s.ratio, 0.39);
eq("profitFactor", s.profitFactor, 1.68);
eq("expectancy", s.expectancy, 26.12);
eq("neededWinRate", s.neededWinRate, 0.72);
eq("largestWin", s.largestWin, 702);
eq("largestLoss", s.largestLoss, -312);
eq("tradingDays", s.tradingDays, 4);
eq("bestDay", s.bestDay.value, 141);
eq("avgDay", s.avgDay, 104.5);
eq("longestWinStreak", s.streaks.longestWin, 7);
eq("longestLossStreak", s.streaks.longestLoss, 2);
eq("max drawdown (daily)", s.drawdown.max, 0);
const bs = balanceSeries(en, [account]);
eq("balance end", bs.end, 25418);
const g = growthStats(en, [account], "2026-10-06");
eq("market days", g.days, 3);
eq("growth/day %", g.perDay * 100, 0.554, 0.002);
eq("days to $1M", daysToTarget(g, 1_000_000), 665, 1.5);
eq("1y projection", projectBalance(g, 1), 102343, 400);
eq("kelly positive", kelly(s.winRate, s.ratio) > 0 ? 1 : 0, 1);
eq("by weekday Monday trades", s.byWeekday.find((x) => x.key === 1).trades, 9);
eq("by hour 10 trades", s.byHour.find((x) => x.key === 10).trades, 8);
eq("R net = pnl/100", computeStats(en, "R", {}).net, 4.18);
eq("% net = pnl/startBalance", computeStats(en, "%", {}).net, (418 / 25000) * 100, 0.001);

eq("monteCarlo needs 100 trades", monteCarlo(en.map((t) => t.pnl)), null);
const many = Array.from({ length: 120 }, (_, i) => (i % 4 === 0 ? -100 : 60));
const mc = monteCarlo(many, { sims: 200 });
eq("monteCarlo end value constant", mc.bands[2].values.at(-1), many.reduce((a, b) => a + b, 0));
eq("risk of ruin returns a probability", riskOfRuin(many, 500, { sims: 300 }).probability >= 0, true);

const accDep = { ...account, adjustments: [{ id: "d", date: "2026-10-05", amount: 5000, note: "" }] };
const enDep = enrich(trades.map((t) => ({ ...t, accountId: accDep.id })), [accDep], TZ);
const gDep = growthStats(enDep, [accDep], "2026-10-06");
eq("deposit does not count as growth", gDep.perDay * 100 < g.perDay * 100 + 0.0001, true);
eq("balance includes deposit", gDep.balance, 30418);

const perf = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
MNQZ6,-2,0,0.25,1,2,3,31544.67,31560.75,$96.50,10/06/2026 10:31:00,10/06/2026 11:01:00,30min
MNQZ6,-2,0,0.25,3,4,2,31010.75,31012.75,$(52.00),10/05/2026 10:10:00,10/05/2026 10:11:00,37sec
MNQZ6,-2,0,0.25,5,6,2,30998.50,30994.00,$18.00,10/05/2026 09:24:00,10/05/2026 09:23:00,15sec`;
const pr = importCsv(perf, { accountId: "a", tz: TZ, commission: 0 });
eq("performance csv count", pr.trades.length, 3);
eq("performance negative pnl", pr.trades[1].pnl, -52);
eq("performance short detected", pr.trades[2].direction, "Short");
eq("short entry = sell price", pr.trades[2].entryPrice, 30994.0);

const orders = `Order ID,Account,B/S,Contract,Product,avgPrice,filledQty,Fill Time,Status
1,ACC1,Buy,MNQZ6,MNQ,31544.50,1,10/06/2026 10:31:00,Filled
2,ACC1,Buy,MNQZ6,MNQ,31545.50,2,10/06/2026 10:32:00,Filled
3,ACC1,Sell,MNQZ6,MNQ,31560.00,3,10/06/2026 11:01:00,Filled
4,ACC1,Sell,MNQZ6,MNQ,31570.00,1,10/06/2026 11:10:00,Filled
5,ACC1,Buy,MNQZ6,MNQ,31560.00,1,10/06/2026 11:20:00,Filled
6,ACC1,Buy,MNQZ6,MNQ,31500.00,1,10/06/2026 11:30:00,Cancelled`;
const or = importCsv(orders, { accountId: "a", tz: TZ, commission: 0.5 });
eq("orders -> 2 trades", or.trades.length, 2);
eq("orders long pnl net of fees", or.trades[0].pnl, 89 - 1.5);
eq("orders long fills", or.trades[0].fills, 3);
eq("orders short pnl", or.trades[1].pnl, 20 - 0.5);

const back = importCsv(exportCsv(en.slice(0, 3), [account], TZ), { accountId: "a", tz: TZ, commission: 0 });
eq("csv export/import roundtrip", back.trades[1].pnl, en[1].pnl);
try {
  importCsv("a,b\n1,2", { accountId: "a", tz: TZ });
  eq("unknown format throws", false, true);
} catch {
  eq("unknown format throws", true, true);
}

const mig = migrateEntries(
  [
    { id: "x2", date: "2026-07-25", symbol: "ethusdt", direction: "Short", result: -1, setup: "Snelweg (200)", mood: "Rustig", lesson: "l", hasScreenshot: true },
    { id: "x1", date: "2026-07-24", symbol: "btcusdt", direction: "Long", result: 2 },
  ],
  makeAccount({ startBalance: 10000, riskValue: 1 }),
  TZ
);
eq("migration oldest first", mig[0].id, "x1");
eq("migration pnl = R * risk$", mig[0].pnl, 200);
eq("migration keeps mood", mig[1].mood, "Rustig");

// ---- rapporten
eq("iso week of 2026-10-05", isoWeekKey("2026-10-05"), "2026-W41");
eq("iso week 2026-01-01 (Thu) is week 1", isoWeekKey("2026-01-01"), "2026-W01");
eq("iso week of 2025-12-29", isoWeekKey("2025-12-29"), "2026-W01");
eq("iso week of 2021-01-03 belongs to 2020-W53", isoWeekKey("2021-01-03"), "2020-W53");
const wk = lastCompletedPeriods("week", 2, "2026-10-07"); // woensdag
eq("last completed week starts Monday 2026-09-28", wk[0].start, "2026-09-28");
eq("...and ends Sunday 2026-10-04", wk[0].end, "2026-10-04");
eq("previous week before that", wk[1].start, "2026-09-21");
const mo = lastCompletedPeriods("month", 2, "2026-01-15");
eq("last completed month across a year boundary", mo[0].key, "2025-12");
eq("...and the one before", mo[1].key, "2025-11");
eq("month range end", mo[0].end, "2025-12-31");
eq("previousPeriod month", previousPeriod("month", "2026-03-01").start, "2026-02-01");
eq("previousPeriod week", previousPeriod("week", "2026-09-28").end, "2026-09-27");

// Eén week met opzet gebouwde patronen: wraakzuchtig verliest, rustig wint, grote uitschieter-loss.
const racc = makeAccount({ name: "R", startBalance: 10000, riskUnit: "$", riskValue: 100, riskMode: "FIXED" });
const mk = (id, day, hh, mm, pnl, mood, setup, qty = 1) => {
  const [y, m, d] = day.split("-").map(Number);
  const open = wallToEpoch(y, m, d, hh, mm, 0, TZ);
  return { id, accountId: racc.id, symbol: "MNQ", direction: "Long", qty, openedAt: open, closedAt: open + 60000, pnl, fees: 0, r: null, setup, mood, lesson: "" };
};
const wkTrades = [
  mk("a1", "2026-09-28", 9, 35, 150, "Rustig", "Snelweg (200)"),
  mk("a2", "2026-09-28", 10, 5, 120, "Rustig", "Snelweg (200)"),
  mk("a3", "2026-09-29", 9, 40, 100, "Rustig", "Snelweg (200)"),
  mk("a4", "2026-09-29", 10, 10, -60, "Wraakzuchtig", "Vangrail (DC)"),
  mk("a5", "2026-09-30", 13, 0, -80, "Wraakzuchtig", "Vangrail (DC)"),
  mk("a6", "2026-09-30", 13, 20, -90, "Wraakzuchtig", "Vangrail (DC)"),
  mk("a7", "2026-10-01", 9, 50, -400, "Gefrustreerd", "Vangrail (DC)"),
  mk("a8", "2026-10-02", 10, 15, 90, "Rustig", "Snelweg (200)"),
];
const rep = buildReport({ trades: wkTrades, accounts: [racc], tz: TZ, kind: "week", start: "2026-09-28", end: "2026-10-04" });
eq("report: trades", rep.kpis.trades, 8);
eq("report: net", rep.kpis.net, -170);
eq("report: netR", rep.kpis.netR, -1.7);
eq("report: wins", rep.kpis.wins, 4);
const ids = (l) => l.map((i) => i.id);
eq("report: calm is the best mood", rep.good.find((i) => i.id === "best_mood")?.p.mood, "Rustig");
eq("report: revenge is the worst mood", rep.improve.find((i) => i.id === "worst_mood")?.p.mood, "Wraakzuchtig");
eq("report: a negative week gets a negative headline", rep.headline.id === "net_negative" && Math.abs(rep.headline.p.usd - -170) < 1e-9, true);
eq("report: the headline is not a ranked point", !ids(rep.improve).includes("net_negative") && !ids(rep.good).includes("net_positive"), true);
const outlierRep = buildReport({
  trades: [
    mk("o1", "2026-09-28", 9, 35, 50, "", ""), mk("o2", "2026-09-28", 10, 5, 50, "", ""), mk("o3", "2026-09-29", 9, 40, -40, "", ""),
    mk("o4", "2026-09-29", 10, 10, 50, "", ""), mk("o5", "2026-09-30", 13, 0, -40, "", ""), mk("o6", "2026-09-30", 13, 20, 50, "", ""),
    mk("o7", "2026-10-01", 9, 50, -400, "", ""), mk("o8", "2026-10-02", 10, 15, -40, "", ""),
  ],
  accounts: [racc], tz: TZ, kind: "week", start: "2026-09-28", end: "2026-10-04",
});
eq("report: a -400 outlier among small losses is flagged", ids(outlierRep.improve).includes("outlier_loss"), true, JSON.stringify(ids(outlierRep.improve)));
eq("report: outlier multiple is large", outlierRep.improve.find((i) => i.id === "outlier_loss").p.multiple > 5, true);
eq("report: best setup is Snelweg", rep.good.find((i) => i.id === "best_setup")?.p.setup, "Snelweg (200)");
eq("report: at most 3 per list", rep.good.length <= 3 && rep.improve.length <= 3, true);
eq("report: focus follows the biggest improvement", rep.focus.id, rep.improve[0].id);
eq("report: mood logging is praised as a habit", rep.habit?.id === "mood_logged" && rep.habit.tone === "good", true);
eq("report: missing moods are flagged as a habit", outlierRep.habit?.id === "mood_missing" && outlierRep.habit.tone === "improve", true);
eq("report: an empty period gives no report", buildReport({ trades: wkTrades, accounts: [racc], tz: TZ, kind: "week", start: "2026-10-05", end: "2026-10-11" }), null);
eq("report: previous week is null when it has no trades", rep.prev, null);
const rep2 = buildReport({ trades: [...wkTrades, mk("p1", "2026-09-22", 10, 0, -300, "Rustig", "Snelweg (200)")], accounts: [racc], tz: TZ, kind: "week", start: "2026-09-28", end: "2026-10-04" });
eq("report: previous week net is compared", rep2.prev.net, -300);
eq("report: the headline carries the change versus last week", Math.abs(rep2.headline.p.delta - 130) < 1e-9, true);
const tiny = buildReport({ trades: wkTrades.slice(0, 2), accounts: [racc], tz: TZ, kind: "week", start: "2026-09-28", end: "2026-10-04" });
eq("report: a tiny sample is flagged as such", tiny.neutral.some((i) => i.id === "low_sample"), true);
const winWeek = buildReport({ trades: wkTrades.filter((t) => ["a1", "a2", "a3", "a8"].includes(t.id)), accounts: [racc], tz: TZ, kind: "week", start: "2026-09-28", end: "2026-10-04" });
eq("report: a good week has no improvement but a keep-going focus", winWeek.improve.length === 0 && winWeek.focus.id === "keep_going", true, JSON.stringify(winWeek.improve.map((i) => i.id)));

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
