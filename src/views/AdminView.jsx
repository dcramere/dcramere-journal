import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api.js";
import { COLORS, MONO, toneColor } from "../theme.js";
import { tr } from "../i18n.js";
import { money, pct, relativeDay } from "../lib/format.js";
import { Button, Card, Empty, Segmented, Select } from "../ui/primitives.jsx";

const SORTS = [
  { value: "activity", label: "Laatste activiteit" },
  { value: "net30", label: "Resultaat 30 dagen" },
  { value: "trades", label: "Aantal trades" },
  { value: "newest", label: "Nieuwste eerst" },
  { value: "name", label: "Naam" },
];

const activity = (u) => Math.max(u.lastLoginAt || 0, u.lastTradeAt || 0);

function Kpi({ label, value }) {
  return (
    <Card>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color: COLORS.text }}>
        {value}
      </div>
    </Card>
  );
}

function Cell({ label, children, color }) {
  return (
    <div className="min-w-0">
      <div className="md:hidden text-[9px] uppercase" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {label}
      </div>
      <div className="text-xs truncate" style={{ color: color || COLORS.text, fontFamily: MONO }}>
        {children}
      </div>
    </div>
  );
}

const GRID = "md:grid-cols-[minmax(0,2.2fr)_repeat(2,minmax(0,1fr))_repeat(2,minmax(0,0.7fr))_repeat(2,minmax(0,1fr))_13rem]";

export function AdminView({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("activity");
  const [status, setStatus] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setUsers((await api.get("/api/admin/users")).users);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clients = useMemo(() => (users || []).filter((u) => u.role === "client"), [users]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (users || []).filter(
      (u) => (status === "all" || u.status === status) && (!needle || `${u.name} ${u.email}`.toLowerCase().includes(needle))
    );
    const by = {
      activity: (a, b) => activity(b) - activity(a),
      net30: (a, b) => b.net30 - a.net30,
      trades: (a, b) => b.trades - a.trades,
      newest: (a, b) => b.createdAt - a.createdAt,
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return [...list].sort(by);
  }, [users, q, sort, status]);

  const weekAgo = Date.now() - 7 * 86400000;
  const activeWeek = clients.filter((u) => u.lastLoginAt && u.lastLoginAt > weekAgo).length;
  const tradingClients = clients.filter((u) => u.trades > 0).length;
  const totalTrades = clients.reduce((s, u) => s + u.trades, 0);

  async function toggle(u) {
    const next = u.status === "active" ? "disabled" : "active";
    const ask = next === "disabled" ? tr("{name} deactiveren? De klant wordt direct uitgelogd en kan niet meer inloggen.", { name: u.name }) : tr("{name} weer activeren?", { name: u.name });
    if (!window.confirm(ask)) return;
    setBusyId(u.id);
    try {
      await api.patch(`/api/admin/users/${u.id}`, { status: next });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={tr("Klanten")} value={users ? clients.length : "—"} />
        <Kpi label={tr("Actief afgelopen 7 dagen")} value={users ? activeWeek : "—"} />
        <Kpi label={tr("Klanten met trades")} value={users ? tradingClients : "—"} />
        <Kpi label={tr("Trades in totaal")} value={users ? totalTrades : "—"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("Zoek op naam of e-mail")}
          aria-label={tr("Zoek op naam of e-mail")}
          className="rounded-lg px-3 py-1.5 text-xs flex-1 min-w-40"
          style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
        />
        <Select label={tr("Sorteer")} value={sort} onChange={setSort} options={SORTS} />
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          ariaLabel={tr("Status")}
          options={[
            { value: "all", label: "Alle" },
            { value: "active", label: "Actief" },
            { value: "disabled", label: "Gedeactiveerd" },
          ]}
        />
        <Button onClick={load} aria-label={tr("Vernieuwen")}>
          <RefreshCw size={12} />
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ color: COLORS.red }}>
          {error}
        </p>
      )}

      <Card className="p-0 overflow-hidden" style={{ padding: 0 }}>
        <div
          className={`hidden md:grid ${GRID} gap-3 px-4 py-2 text-[9px] uppercase tracking-widest`}
          style={{ color: COLORS.textMuted, fontFamily: MONO, borderBottom: `1px solid ${COLORS.grid}` }}
        >
          <span>{tr("Klant")}</span>
          <span>{tr("Laatst ingelogd")}</span>
          <span>{tr("Laatste trade")}</span>
          <span>{tr("Trades")}</span>
          <span>{tr("Win %")}</span>
          <span>{tr("Resultaat 30d")}</span>
          <span>{tr("Resultaat totaal")}</span>
          <span />
        </div>

        {users == null && !error ? (
          <Empty>{tr("Klanten laden…")}</Empty>
        ) : rows.length === 0 ? (
          <Empty>{tr("Geen klanten gevonden.")}</Empty>
        ) : (
          rows.map((u) => {
            const decided = u.wins + u.losses;
            const self = u.id === currentUserId;
            return (
              <div
                key={u.id}
                className={`grid grid-cols-2 ${GRID} gap-x-3 gap-y-2 px-4 py-3 items-center`}
                style={{ borderBottom: `1px solid ${COLORS.grid}`, opacity: u.status === "disabled" ? 0.55 : 1 }}
              >
                <div className="col-span-2 md:col-span-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>
                    {u.name}
                    {u.role === "admin" && (
                      <span className="ml-2 text-[9px] tracking-widest rounded px-1.5 py-0.5" style={{ color: COLORS.gold, border: `1px solid ${COLORS.gold}`, fontFamily: MONO }}>
                        {tr("BEHEERDER")}
                      </span>
                    )}
                    {u.status === "disabled" && (
                      <span className="ml-2 text-[9px] tracking-widest rounded px-1.5 py-0.5" style={{ color: COLORS.red, border: `1px solid ${COLORS.red}`, fontFamily: MONO }}>
                        {tr("GEDEACTIVEERD")}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: COLORS.textMuted }}>
                    {u.email}
                  </div>
                </div>
                <Cell label={tr("Laatst ingelogd")}>{relativeDay(u.lastLoginAt)}</Cell>
                <Cell label={tr("Laatste trade")}>{relativeDay(u.lastTradeAt)}</Cell>
                <Cell label={tr("Trades")}>{u.trades}</Cell>
                <Cell label={tr("Win %")}>{decided ? pct(u.wins / decided) : "—"}</Cell>
                <Cell label={tr("Resultaat 30d")} color={u.trades30 ? toneColor(u.net30) : undefined}>
                  {u.trades30 ? money(u.net30, { sign: true, dec: 0 }) : "—"}
                </Cell>
                <Cell label={tr("Resultaat totaal")} color={u.trades ? toneColor(u.net) : undefined}>
                  {u.trades ? money(u.net, { sign: true, dec: 0 }) : "—"}
                </Cell>
                <div className="col-span-2 md:col-span-1 flex gap-2 md:justify-end">
                  <a
                    href={self ? "#/journal" : `#/admin/user/${u.id}/journal`}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: COLORS.gold, color: "#0A0A0A" }}
                  >
                    {tr("Open")}
                  </a>
                  {u.role !== "admin" && (
                    <Button onClick={() => toggle(u)} disabled={busyId === u.id}>
                      {u.status === "active" ? tr("Deactiveren") : tr("Activeren")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        {tr("Je kunt journals alleen lezen. Elk bezoek aan het journal van een klant wordt vastgelegd en is zichtbaar voor die klant.")}
      </p>
    </div>
  );
}
