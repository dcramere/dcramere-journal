import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { COLORS, MONO, MOODS, SETUPS, toneColor } from "../theme.js";
import { getShot } from "../shots.js";
import { exportCsv } from "../lib/csv.js";
import { dayLabel, duration, money, timeLabel, unitValue } from "../lib/format.js";
import { Button, Card, Empty, Select } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";

function TradeDetail({ trade, account, unit, onEdit, onDelete, readOnly }) {
  const [shot, setShot] = useState(null);
  const [shotState, setShotState] = useState(trade.hasScreenshot ? "loading" : "none");

  useEffect(() => {
    if (!trade.hasScreenshot) return;
    let live = true;
    getShot(trade.id)
      .then((value) => live && (setShot(value), setShotState("ok")))
      .catch(() => live && setShotState("error"));
    return () => {
      live = false;
    };
  }, [trade.id, trade.hasScreenshot]);

  const cell = (label, value, color) => (
    <div>
      <div className="uppercase text-[9px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {label}
      </div>
      <div className="text-xs font-semibold" style={{ color: color || COLORS.text }}>
        {value}
      </div>
    </div>
  ); return (
    <div className="px-3 pb-3 pt-1 flex flex-col gap-3" style={{ background: COLORS.cardHi }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cell(tr("Account"), account ? account.name : "—")}
        {cell(tr("Setup"), trade.setup ? tr(trade.setup) : "—")}
        {cell(tr("Emotie"), trade.mood ? tr(trade.mood) : "—")}
        {cell(tr("Kosten"), money(trade.fees || 0))}
        {cell(tr("Resultaat $"), money(trade.v.$, { sign: true }), toneColor(trade.v.$))}
        {cell(tr("Resultaat %"), trade.v["%"] == null ? "—" : unitValue(trade.v["%"], "%", { sign: true }), toneColor(trade.v["%"]))}
        {cell(tr("Resultaat R"), trade.v.R == null ? "—" : unitValue(trade.v.R, "R", { sign: true }), toneColor(trade.v.R))}
        {cell(tr("Saldo erna"), money(trade.balAfter))}
      </div>
      {trade.lesson && (
        <p className="text-xs italic" style={{ color: COLORS.text }}>
          “{trade.lesson}”
        </p>
      )}
      {shotState === "loading" && (
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {tr("Screenshot laden…")}
        </p>
      )}
      {shotState === "error" && (
        <p className="text-xs" style={{ color: COLORS.red }}>
          {tr("Screenshot kon niet worden geladen.")}
        </p>
      )}
      {shot && <img src={shot} alt={`Screenshot ${trade.symbol}`} className="rounded max-w-full sm:max-w-lg" style={{ border: `1px solid ${COLORS.cardBorder}` }} />}
      {!readOnly && (
        <div className="flex gap-2">
          <Button onClick={() => onEdit(trade)}>
            <span className="inline-flex items-center gap-1">
              <Pencil size={12} /> {tr("Bewerken")}
            </span>
          </Button>
          <Button variant="danger" onClick={() => onDelete(trade)}>
            <span className="inline-flex items-center gap-1">
              <Trash2 size={12} /> {tr("Verwijderen")}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function TradesView({ ctx, accounts, filters, setFilters, focusId, onEdit, onDelete, onNew, tz, allAccountTrades, readOnly }) {
  const { scoped, unit } = ctx;
  const [open, setOpen] = useState(focusId || null);
  const [showFilters, setShowFilters] = useState(false);
  const focusRef = useRef(null);

  useEffect(() => {
    if (focusId) setOpen(focusId);
  }, [focusId]);

  useEffect(() => {
    if (focusRef.current) focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, open]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const setups = useMemo(() => [...new Set([...SETUPS, ...scoped.map((t) => t.setup).filter(Boolean)])], [scoped]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return scoped.filter((t) => {
      if (filters.day && t.day !== filters.day) return false;
      if (filters.direction !== "all" && t.direction !== filters.direction) return false;
      if (filters.result === "win" && !(t.v[unit] > 0)) return false; if (filters.result === "loss" && !(t.v[unit] < 0)) return false;
      if (filters.setup !== "all" && t.setup !== filters.setup) return false;
      if (filters.mood !== "all" && (filters.mood === "none" ? t.mood : t.mood !== filters.mood)) return false;
      if (q && !`${t.symbol} ${t.lesson} ${t.setup} ${t.mood}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scoped, filters, unit]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of [...filtered].reverse()) {
      if (!map.has(t.day)) map.set(t.day, []);
      map.get(t.day).push(t);
    }
    return [...map.entries()];
  }, [filtered]);

  const activeFilters =
    filters.day || filters.q || filters.direction !== "all" || filters.result !== "all" || filters.setup !== "all" || filters.mood !== "all";

  function download() {
    const csv = exportCsv(allAccountTrades, accounts, tz);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dcramere-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 flex-1 text-left"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
          aria-expanded={showFilters}
        >
          <span className="font-semibold">{tr("Filter deze trades")}</span>
          <span style={{ color: COLORS.textMuted }}>
            {tr(filtered.length === 1 ? "{n} trade" : "{n} trades", { n: filtered.length })}
            {activeFilters ? tr(", gefilterd (van {n})", { n: scoped.length }) : tr(", ongefilterd")}
          </span>
          <ChevronDown size={14} className="ml-auto" style={{ transform: showFilters ? "rotate(180deg)" : "none" }} />
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold shrink-0"
            style={{ background: COLORS.gold, color: "#0A0A0A" }}
          >
            <Plus size={14} /> {tr("Trade loggen")}
          </button>
        )}
      </div>

      {showFilters && (
        <Card className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder={tr("Zoek op symbool of notitie")}
            className="rounded-lg px-3 py-1.5 text-xs flex-1 min-w-40"
            style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
          />
          <Select
            label={tr("Richting")}
            value={filters.direction}
            onChange={(direction) => setFilters({ ...filters, direction })}
            options={[
              { value: "all", label: "Alle" },
              { value: "Long", label: "Long" },
              { value: "Short", label: "Short" },
            ]}
          />
          <Select
            label={tr("Uitkomst")}
            value={filters.result}
            onChange={(result) => setFilters({ ...filters, result })}
            options={[
              { value: "all", label: "Alle" },
              { value: "win", label: "Winst" },
              { value: "loss", label: "Verlies" },
            ]}
          />
          <Select
            label={tr("Setup")}
            value={filters.setup}
            onChange={(setup) => setFilters({ ...filters, setup })}
            options={[{ value: "all", label: "Alle" }, ...setups.map((s) => ({ value: s, label: s }))]}
          />
          <Select
            label={tr("Emotie")}
            value={filters.mood}
            onChange={(mood) => setFilters({ ...filters, mood })}
            options={[{ value: "all", label: "Alle" }, ...MOODS.map((m) => ({ value: m, label: m })), { value: "none", label: "Niet ingevuld" }]}
          />
          {activeFilters && (
            <Button onClick={() => setFilters({ q: "", day: null, direction: "all", result: "all", setup: "all", mood: "all" })}>{tr("Wis filters")}</Button>
          )}
        </Card>
      )}

      {filters.day && (
        <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
          <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>
            {dayLabel(filters.day)}
            <button type="button" aria-label={tr("Dagfilter wissen")} onClick={() => setFilters({ ...filters, day: null })}>
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <Empty>{scoped.length ? "Geen trades die aan je filters voldoen." : "Nog geen trades. Log er een, of importeer een bestand op het tabblad Import."}</Empty>
        </Card>
      ) : (
        groups.map(([day, list]) => {
          const total = list.reduce((s, t) => s + (t.v[unit] || 0), 0); return (
            <Card key={day} className="p-0 overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${COLORS.grid}` }}>
                <h3 className="text-sm font-semibold first-letter:uppercase" style={{ color: COLORS.text }}>
                  {dayLabel(day)}
                </h3>
                <span className="text-xs font-bold" style={{ color: toneColor(total), fontFamily: MONO }}>
                  {unitValue(total, unit, { sign: true })}
                </span>
              </div>
              {list.map((t) => {
                const isOpen = open === t.id;
                const v = t.v[unit];
                return (
                  <div key={t.id} ref={isOpen && focusId === t.id ? focusRef : null} style={{ borderBottom: `1px solid ${COLORS.grid}` }}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : t.id)}
                      aria-expanded={isOpen}
                      className="w-full grid items-center gap-2 px-3 py-2 text-left text-xs"
                      style={{ gridTemplateColumns: "92px minmax(0,1fr) auto", background: isOpen ? COLORS.cardHi : "transparent" }}
                    >
                      <span style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                        <span className="block">
                          {timeLabel(t.openedAt, tz)}–{timeLabel(t.closedAt, tz)}
                        </span>
                        <span className="block text-[10px]">{duration(t.closedAt - t.openedAt)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="font-semibold" style={{ color: COLORS.text }}>
                          {t.symbol}{" "}
                          <span style={{ color: t.direction === "Long" ? COLORS.green : COLORS.red }}>{t.direction}</span> ×{t.qty}
                        </span>
                        <span className="block truncate text-[10px]" style={{ color: COLORS.textMuted }}>
                          {t.entryPrice != null || t.exitPrice != null ? `${t.entryPrice ?? "—"} → ${t.exitPrice ?? "—"}` : tr(t.setup || "")}
                          {t.mood ? ` · ${tr(t.mood)}` : ""}
                          {t.fills > 1 ? ` · ${tr("{n} fills", { n: t.fills })}` : ""}
                        </span>
                      </span>
                      <span className="font-bold text-sm text-right" style={{ color: toneColor(v), fontFamily: MONO }}>
                        {unitValue(v, unit, { sign: true })}
                      </span>
                    </button>
                    {isOpen && <TradeDetail trade={t} account={accountById.get(t.accountId)} unit={unit} onEdit={onEdit} onDelete={onDelete} readOnly={readOnly} />}
                  </div>
                );
              })}
            </Card>
          );
        })
      )}

      {!readOnly && (
        <div className="flex items-center justify-between gap-2 pt-2 text-xs" style={{ color: COLORS.textMuted }}>
          <span>{tr("Van jou om te bewaren: alles als spreadsheet (CSV).")}</span>
          <Button onClick={download} disabled={!allAccountTrades.length}>
            <span className="inline-flex items-center gap-1">
              <Download size={12} /> {tr("Download CSV")}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
