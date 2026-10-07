import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { buildReport, lastCompletedPeriods } from "../lib/report.js";
import { todayInTz } from "../lib/tz.js";

const WEEKS = 4;
const MONTHS = 3;

// Rapporten uit de eigen berekening (lokale modus: alles zit al in de browser).
function computeLocal(journal) {
  const tz = journal.settings.timezone;
  const today = todayInTz(tz);
  const periods = [
    ...lastCompletedPeriods("week", WEEKS, today).map((p) => ({ kind: "week", ...p })),
    ...lastCompletedPeriods("month", MONTHS, today).map((p) => ({ kind: "month", ...p })),
  ];
  return periods
    .map((p) => {
      const data = buildReport({ trades: journal.trades, accounts: journal.accounts, tz, kind: p.kind, start: p.start, end: p.end });
      return data ? { id: `${p.kind}:${p.key}`, kind: p.kind, periodKey: p.key, periodStart: p.start, periodEnd: p.end, data, createdAt: Date.now() } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
}

// Haalt de rapporten op: van de server (eigen journal of, als beheerder, van een klant) of lokaal berekend.
export function useReports(journal, enabled) {
  const local = journal.mode === "local";
  const userId = journal.owner?.id;
  const [state, setState] = useState({ reports: [], loading: true, error: "" });
  const tradeCount = journal.trades.length;

  const localReports = useMemo(() => (local && enabled ? computeLocal(journal) : null), [local, enabled, journal.trades, journal.accounts, journal.settings.timezone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (local || !enabled) return undefined;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const path = journal.readOnly ? `/api/admin/users/${userId}/reports` : "/api/reports";
    api
      .get(path)
      .then((res) => live && setState({ reports: res.reports, loading: false, error: "" }))
      .catch((e) => live && setState({ reports: [], loading: false, error: e.message }));
    return () => {
      live = false;
    };
  }, [local, enabled, journal.readOnly, userId, tradeCount]);

  return local ? { reports: localReports || [], loading: false, error: "" } : state;
}
