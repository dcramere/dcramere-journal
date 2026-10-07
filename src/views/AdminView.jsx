import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api.js";
import { COLORS, MONO, toneColor } from "../theme.js";
import { tr } from "../i18n.js";
import { money, pct, relativeDay } from "../lib/format.js";
import { Button, Card, Empty, Modal, Segmented, Select } from "../ui/primitives.jsx";
import { focusText, habitText, insightText, periodLabel, reportShareText } from "../lib/reportText.js";

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
  const [link, setLink] = useState(null); // { name, url, expiresAt }
  const [weekly, setWeekly] = useState(null);
  const [copied, setCopied] = useState(false);

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
    api
      .get("/api/admin/reports/latest")
      .then((r) => setWeekly(r.items))
      .catch(() => setWeekly([]));
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

  async function makeLink(u) {
    setBusyId(u.id);
    setError("");
    try {
      const { token, expiresAt } = await api.post(`/api/admin/users/${u.id}/reset-link`);
      setCopied(false);
      setLink({ name: u.name, url: `${window.location.origin}/#/reset?token=${token}`, expiresAt });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      document.getElementById("reset-link-input")?.select();
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

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold" style={{ color: COLORS.text }}>
            {weekly && weekly[0] ? tr("Weekrapporten: {label}", { label: periodLabel("week", weekly[0].report.periodKey, weekly[0].report.periodStart, weekly[0].report.periodEnd) }) : tr("Weekrapporten")}
          </h3>
          <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
            {tr("Automatisch berekend uit de gelogde trades van elke klant.")}
          </span>
        </div>
        {weekly == null ? (
          <Empty>{tr("Rapporten laden…")}</Empty>
        ) : weekly.length === 0 ? (
          <Empty>{tr("Nog geen weekrapporten. Ze verschijnen zodra een klant in een afgeronde week trades heeft gelogd.")}</Empty>
        ) : (
          <div className="flex flex-col">
            {weekly.map(({ user: u, report }) => {
              const d = report.data;
              const good = d.good[0] ? insightText(d.good[0], d.kind) : d.habit && d.habit.tone === "good" ? habitText(d.habit) : null;
              const improve = d.improve[0] ? insightText(d.improve[0], d.kind) : d.habit && d.habit.tone === "improve" ? habitText(d.habit) : null;
              const label = tr("Weekrapport {label}", { label: periodLabel("week", report.periodKey, report.periodStart, report.periodEnd) });
              return (
                <div key={u.id} className="grid gap-x-3 gap-y-1 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)_auto] items-start" style={{ borderTop: `1px solid ${COLORS.grid}` }}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>
                      {u.name}
                    </div>
                    <div className="text-xs" style={{ color: toneColor(d.kpis.net), fontFamily: MONO }}>
                      {money(d.kpis.net, { sign: true, dec: 0 })} · {d.kpis.trades} trades · {pct(d.kpis.winRate)}
                    </div>
                  </div>
                  <div className="text-xs flex flex-col gap-1 min-w-0" style={{ color: COLORS.textMuted }}>
                    {good && <span style={{ borderLeft: `2px solid ${COLORS.green}`, paddingLeft: 8 }}>{good}</span>}
                    {improve && <span style={{ borderLeft: `2px solid ${COLORS.gold}`, paddingLeft: 8 }}>{improve}</span>}
                    <span style={{ color: COLORS.text }}>🎯 {focusText(d.focus, d.kind)}</span>
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <a href={`#/admin/user/${u.id}/reports`} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: COLORS.gold, color: "#0A0A0A" }}>
                      {tr("Rapport")}
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(reportShareText(report, { name: u.name, label }))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

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
                  {u.role !== "admin" && u.status === "active" && (
                    <Button onClick={() => makeLink(u)} disabled={busyId === u.id}>
                      {tr("Resetlink")}
                    </Button>
                  )}
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

      {link && (
        <Modal title={tr("Resetlink voor {name}", { name: link.name })} onClose={() => setLink(null)}>
          <div className="flex flex-col gap-3 text-xs" style={{ color: COLORS.textMuted }}>
            <p>{tr("Stuur deze link zelf naar de klant (bijvoorbeeld via WhatsApp). Met de link kiest de klant een nieuw wachtwoord. Hij werkt één keer en is 24 uur geldig; een eerdere link van deze klant vervalt.")}</p>
            <input
              id="reset-link-input"
              readOnly
              value={link.url}
              onFocus={(e) => e.target.select()}
              className="rounded-lg px-3 py-2 text-xs w-full"
              style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, fontFamily: MONO }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: COLORS.gold, color: "#0A0A0A" }}>
                {copied ? tr("Gekopieerd") : tr("Link kopiëren")}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  tr("Hoi {name}, hier is je link om een nieuw wachtwoord te kiezen voor DCRAMERE Journal (24 uur geldig, één keer te gebruiken): {link}", { name: link.name, link: link.url })
                )}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
              >
                {tr("Deel via WhatsApp")}
              </a>
            </div>
            <p className="text-[11px]">{tr("Dit wordt vastgelegd en is zichtbaar voor de klant. Na het gebruik van de link wordt de klant overal uitgelogd.")}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
