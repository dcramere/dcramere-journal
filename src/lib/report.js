// Periodieke rapporten: wat gaat goed en waar kun je verbeteren, afgeleid van de cijfers.
// Zuiver rekenwerk zonder tekst: de uitkomst bevat alleen codes en getallen, zodat de app
// het in het Nederlands én Engels kan tonen (zie reportText.js). Draait in browser en server.
import { computeStats, groupStats } from "./metrics.js";
import { enrich } from "./model.js";
import { addDays, parseDate } from "./tz.js";

export const REPORT_VERSION = 2; // ophogen als de opbouw van het rapport verandert: opgeslagen rapporten worden dan opnieuw berekend
const MIN_GROUP = 3; // minimaal aantal trades voordat een groep (emotie, setup, dag, uur) iets zegt
const MIN_TRADES = 5;

const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const finite = (v) => (Number.isFinite(v) ? v : null);

// ---------- Periodes ----------

function weekStartOf(date) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = zondag
  return addDays(date, -((dow + 6) % 7));
}

export function isoWeekKey(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // donderdag van deze week
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const pad = (n) => String(n).padStart(2, "0");

function monthRange(y, mo) {
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { key: `${y}-${pad(mo)}`, start: `${y}-${pad(mo)}-01`, end: `${y}-${pad(mo)}-${pad(last)}` };
}

// De laatste `count` afgeronde weken of maanden, nieuwste eerst.
export function lastCompletedPeriods(kind, count, today) {
  const out = [];
  if (kind === "week") {
    const thisWeek = weekStartOf(today);
    for (let i = 1; i <= count; i += 1) {
      const start = addDays(thisWeek, -7 * i);
      out.push({ key: isoWeekKey(start), start, end: addDays(start, 6) });
    }
  } else {
    const { y, mo } = parseDate(today);
    for (let i = 1; i <= count; i += 1) {
      const idx = y * 12 + (mo - 1) - i;
      out.push(monthRange(Math.floor(idx / 12), (idx % 12) + 1));
    }
  }
  return out;
}

export function previousPeriod(kind, start) {
  if (kind === "week") return { start: addDays(start, -7), end: addDays(start, -1) };
  const { y, mo } = parseDate(start);
  const idx = y * 12 + (mo - 1) - 1;
  const r = monthRange(Math.floor(idx / 12), (idx % 12) + 1);
  return { start: r.start, end: r.end };
}

// ---------- Kerncijfers ----------

function kpisOf(s, sr) {
  return {
    trades: s.trades,
    wins: s.wins,
    losses: s.losses,
    net: s.net,
    netR: sr.net,
    winRate: s.winRate,
    profitFactor: finite(s.profitFactor),
    expectancy: s.expectancy,
    expectancyR: sr.expectancy,
    ratio: finite(s.ratio),
    neededWinRate: s.neededWinRate,
    avgWin: s.avgWin,
    avgLoss: s.avgLoss,
    tradingDays: s.tradingDays,
    greenDays: s.winDays,
    redDays: s.lossDays,
    bestDay: s.bestDay ? { date: s.bestDay.date, value: s.bestDay.value } : null,
    worstDay: s.worstDay ? { date: s.worstDay.date, value: s.worstDay.value } : null,
    maxDrawdown: s.drawdown.max,
  };
}

// ---------- Inzichten ----------

function groupsOf(trades, keyFn) {
  return groupStats(trades, keyFn, "R").filter((g) => g.trades >= MIN_GROUP);
}

function pickExtremes(groups) {
  if (!groups.length) return { best: null, worst: null };
  const sorted = [...groups].sort((a, b) => b.expectancy - a.expectancy);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

function deriveInsights({ cur, s, sr, prev }) {
  const good = [];
  const improve = [];
  const neutral = [];
  const usd = s.net;

  if (s.trades < MIN_TRADES) neutral.push({ id: "low_sample", score: 0, p: { n: s.trades } });

  // Het eindresultaat is een kop boven het rapport en geen verbeterpunt: de oorzaken staan in de lijsten.
  const headline = {
    id: usd > 0 ? "net_positive" : usd < 0 ? "net_negative" : "net_flat",
    p: { usd, r: sr.net, delta: prev && prev.trades > 0 ? usd - prev.net : null },
  };

  // Win % tegenover wat je nodig hebt
  if (s.trades >= MIN_TRADES && s.winRate != null && s.neededWinRate != null) {
    if (s.winRate >= s.neededWinRate + 0.05) good.push({ id: "winrate_above_needed", score: 0.8, p: { winRate: s.winRate, needed: s.neededWinRate } });
    else if (s.winRate < s.neededWinRate - 0.02) improve.push({ id: "winrate_below_needed", score: 0.9, p: { winRate: s.winRate, needed: s.neededWinRate } });
  }

  // Verhouding winst/verlies
  if (s.ratio != null && s.wins >= 2 && s.losses >= 2) {
    if (s.ratio >= 1.5) good.push({ id: "payoff_good", score: 0.7, p: { ratio: s.ratio } });
    else if (s.ratio < 0.8 && (s.winRate ?? 0) < 0.65) improve.push({ id: "payoff_poor", score: 1.2, p: { ratio: s.ratio } });
  }

  // Emotie
  const moods = pickExtremes(groupsOf(cur, (t) => t.mood));
  if (moods.best && moods.best.expectancy > 0.1)
    good.push({ id: "best_mood", score: Math.abs(moods.best.net) + 0.5, p: { mood: moods.best.key, n: moods.best.trades, avgR: moods.best.expectancy, netR: moods.best.net } });
  if (moods.worst && moods.worst !== moods.best && moods.worst.expectancy < -0.1) {
    const dollars = sum(cur.filter((t) => t.mood === moods.worst.key).map((t) => t.v.$));
    improve.push({ id: "worst_mood", score: Math.abs(moods.worst.net) + 1, p: { mood: moods.worst.key, n: moods.worst.trades, avgR: moods.worst.expectancy, netR: moods.worst.net, usd: dollars } });
  }
  // Logdiscipline staat los van de ranglijst: een aparte regel die altijd zichtbaar blijft.
  const moodShare = cur.filter((t) => t.mood).length / cur.length;
  let habit = null;
  if (s.trades >= MIN_TRADES) {
    if (moodShare >= 0.8) habit = { id: "mood_logged", tone: "good", p: { share: moodShare } };
    else if (moodShare < 0.5) habit = { id: "mood_missing", tone: "improve", p: { share: moodShare } };
  }

  // Setup
  const setups = pickExtremes(groupsOf(cur, (t) => t.setup));
  if (setups.best && setups.best.expectancy > 0.1)
    good.push({ id: "best_setup", score: Math.abs(setups.best.net) + 0.5, p: { setup: setups.best.key, n: setups.best.trades, avgR: setups.best.expectancy, winRate: setups.best.winRate } });
  if (setups.worst && setups.worst !== setups.best && setups.worst.expectancy < -0.1)
    improve.push({ id: "worst_setup", score: Math.abs(setups.worst.net) + 1, p: { setup: setups.worst.key, n: setups.worst.trades, avgR: setups.worst.expectancy, winRate: setups.worst.winRate } });

  // Weekdag en uur
  const days = pickExtremes(groupsOf(cur, (t) => t.dow));
  if (days.best && days.best.expectancy > 0.1) good.push({ id: "best_weekday", score: Math.abs(days.best.net) + 0.3, p: { dow: days.best.key, n: days.best.trades, avgR: days.best.expectancy } });
  if (days.worst && days.worst !== days.best && days.worst.expectancy < -0.1)
    improve.push({ id: "worst_weekday", score: Math.abs(days.worst.net) + 0.6, p: { dow: days.worst.key, n: days.worst.trades, avgR: days.worst.expectancy } });
  const hours = pickExtremes(groupsOf(cur, (t) => t.openHour));
  if (hours.best && hours.best.expectancy > 0.1) good.push({ id: "best_hour", score: Math.abs(hours.best.net) + 0.3, p: { hour: hours.best.key, n: hours.best.trades, avgR: hours.best.expectancy } });
  if (hours.worst && hours.worst !== hours.best && hours.worst.expectancy < -0.1)
    improve.push({ id: "worst_hour", score: Math.abs(hours.worst.net) + 0.6, p: { hour: hours.worst.key, n: hours.worst.trades, avgR: hours.worst.expectancy } });

  // Gedrag: uitschieters, positiegrootte, tilt, overtraden, reeksen, terugval
  const lossTrades = cur.filter((t) => t.v.$ < 0).sort((a, b) => a.v.$ - b.v.$);
  if (lossTrades.length >= 3) {
    const typical = mean(lossTrades.slice(1).map((t) => Math.abs(t.v.$)));
    const worst = lossTrades[0];
    if (typical > 0 && Math.abs(worst.v.$) > 2.5 * typical)
      improve.push({ id: "outlier_loss", score: Math.abs(worst.v.R ?? 0) + 1, p: { usd: worst.v.$, multiple: Math.abs(worst.v.$) / typical } });
  }
  const qtys = cur.map((t) => t.qty);
  if (cur.length >= 6) {
    const m = mean(qtys);
    const sd = Math.sqrt(mean(qtys.map((q) => (q - m) ** 2)));
    const min = Math.min(...qtys);
    const max = Math.max(...qtys);
    if (m > 0 && sd / m > 0.6 && max >= 3 * min) improve.push({ id: "size_inconsistent", score: 0.8, p: { min, max } });
  }
  let sizeUps = 0;
  let sizeUpR = 0;
  for (let i = 1; i < cur.length; i += 1) {
    const a = cur[i - 1];
    const b = cur[i];
    if (a.day === b.day && a.v.$ < 0 && b.qty >= a.qty * 1.5) {
      sizeUps += 1;
      sizeUpR += b.v.R ?? 0;
    }
  }
  if (sizeUps >= 2 && sizeUpR < 0) improve.push({ id: "size_up_after_loss", score: Math.abs(sizeUpR) + 1, p: { n: sizeUps, r: sizeUpR } });

  const perDay = s.days.map((d) => d.trades).sort((a, b) => a - b);
  if (perDay.length >= 4) {
    const med = perDay[Math.floor(perDay.length / 2)];
    const limit = Math.max(6, Math.ceil(med * 2));
    const busy = s.days.filter((d) => d.trades >= limit);
    const calm = s.days.filter((d) => d.trades < limit);
    if (busy.length >= 2 && calm.length >= 2 && mean(busy.map((d) => d.value)) < 0 && mean(calm.map((d) => d.value)) > mean(busy.map((d) => d.value)))
      improve.push({ id: "overtrading", score: Math.abs(sum(busy.map((d) => d.value))) / (s.avgLoss || 1) + 0.5, p: { n: limit, busyUsd: mean(busy.map((d) => d.value)), calmUsd: mean(calm.map((d) => d.value)) } });
  }
  if (s.streaks.longestLoss >= 4) improve.push({ id: "loss_streak", score: s.streaks.longestLoss / 2, p: { n: s.streaks.longestLoss } });
  if (s.streaks.longestWin >= 5) good.push({ id: "win_streak", score: 0.3, p: { n: s.streaks.longestWin } });
  if (s.trades >= 8 && s.avgLoss > 0 && s.drawdown.max > 4 * s.avgLoss) improve.push({ id: "drawdown_deep", score: 1, p: { usd: s.drawdown.max } });
  else if (s.trades >= 8 && s.drawdown.max === 0) good.push({ id: "no_drawdown", score: 0.4, p: {} });
  if (s.tradingDays >= 3 && s.winDays / s.tradingDays >= 0.7) good.push({ id: "consistent_days", score: 0.5, p: { green: s.winDays, days: s.tradingDays } });

  const top = (list, n) => list.sort((a, b) => b.score - a.score).slice(0, n);
  const topGood = top(good, 3);
  const topImprove = top(improve, 3);
  let focus = { id: "keep_going", p: {} };
  if (topImprove[0]) focus = { id: topImprove[0].id, p: topImprove[0].p };
  else if (habit && habit.id === "mood_missing") focus = { id: "mood_missing", p: habit.p };
  return { headline, good: topGood, improve: topImprove, neutral, habit, focus };
}

// Bouwt het rapport voor één periode. Geeft null als er in die periode geen trades zijn.
export function buildReport({ trades, accounts, tz, kind, start, end }) {
  const all = enrich(trades, accounts, tz);
  const within = (a, b) => all.filter((t) => t.day >= a && t.day <= b);
  const cur = within(start, end);
  if (!cur.length) return null;

  const before = previousPeriod(kind, start);
  const prevTrades = within(before.start, before.end);
  const startBalance = sum(accounts.map((a) => Number(a.startBalance) || 0));
  const s = computeStats(cur, "$", { startBalance });
  const sr = computeStats(cur, "R", {});
  const prev = prevTrades.length ? kpisOf(computeStats(prevTrades, "$", { startBalance }), computeStats(prevTrades, "R", {})) : null;

  return {
    version: REPORT_VERSION,
    kind,
    start,
    end,
    kpis: kpisOf(s, sr),
    prev,
    ...deriveInsights({ cur, s, sr, prev }),
  };
}
