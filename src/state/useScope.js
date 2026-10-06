import { useMemo } from "react";
import { enrich } from "../lib/model.js";
import { balanceSeries, computeStats } from "../lib/metrics.js";
import { addDays, parseDate, todayInTz } from "../lib/tz.js";

export function periodRange(period, today) {
  const { y, mo } = parseDate(today);
  const pad = (n) => String(n).padStart(2, "0");
  switch (period) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: `${y}-${pad(mo)}-01`, to: today };
    case "lastMonth": {
      const py = mo === 1 ? y - 1 : y;
      const pm = mo === 1 ? 12 : mo - 1;
      const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}` };
    }
    case "year":
      return { from: `${y}-01-01`, to: today };
    default:
      return null;
  }
}

// Combineert filters (account, periode, eenheid) met de berekende statistieken.
export function useScope({ accounts, trades, settings }) {
  const tz = settings.timezone;
  const unit = settings.unit;
  const today = todayInTz(tz);

  const enrichedAll = useMemo(() => enrich(trades, accounts, tz), [trades, accounts, tz]);

  const scopedAccounts = useMemo(
    () => (settings.accountId === "all" ? accounts : accounts.filter((a) => a.id === settings.accountId)),
    [accounts, settings.accountId]
  );

  const range = useMemo(() => periodRange(settings.period, today), [settings.period, today]);

  const accountTrades = useMemo(
    () => enrichedAll.filter((t) => settings.accountId === "all" || t.accountId === settings.accountId),
    [enrichedAll, settings.accountId]
  );

  const scoped = useMemo(
    () => (range ? accountTrades.filter((t) => t.day >= range.from && t.day <= range.to) : accountTrades),
    [accountTrades, range]
  );

  const startBalance = useMemo(
    () => scopedAccounts.reduce((s, a) => s + (Number(a.startBalance) || 0), 0),
    [scopedAccounts]
  );

  const stats = useMemo(() => computeStats(scoped, unit, { startBalance }), [scoped, unit, startBalance]);
  const balance = useMemo(() => balanceSeries(accountTrades, scopedAccounts), [accountTrades, scopedAccounts]);

  return { tz, unit, today, enrichedAll, accountTrades, scoped, scopedAccounts, range, startBalance, stats, balance };
}
