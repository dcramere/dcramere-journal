import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, HelpCircle, Plus } from "lucide-react";
import { COLORS, MONO } from "./theme.js";
import { useJournal } from "./state/useJournal.js";
import { useScope } from "./state/useScope.js";
import { FilterBar } from "./components/FilterBar.jsx";
import { TradeForm } from "./components/TradeForm.jsx";
import HelpPanel from "./HelpPanel.jsx";
import { JournalView, cursorFor } from "./views/JournalView.jsx";
import { TradesView } from "./views/TradesView.jsx";
import { StatsView } from "./views/StatsView.jsx";
import { ImportView } from "./views/ImportView.jsx";
import { setLang, tr } from "./i18n.js";
import { Segmented } from "./ui/primitives.jsx";

const TABS = [
  { id: "import", title: "Import", sub: "Trades en accounts" },
  { id: "journal", title: "Journal", sub: "Je recente trades" },
  { id: "trades", title: "Trades", sub: "Lijst van trades" },
  { id: "stats", title: "Stats", sub: "Je prestaties" },
];

const EMPTY_FILTERS = { q: "", day: null, direction: "all", result: "all", setup: "all", mood: "all" };

function readHash() {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.some((t) => t.id === id) ? id : "journal";
}

export default function App() {
  const journal = useJournal();
  const { ready, accounts, trades, settings, saveError, updateSettings, addTrade, updateTrade, deleteTrade } = journal;
  setLang(settings.lang);

  const [view, setView] = useState(readHash);
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState(null); // null | { trade?: enrichedTrade }
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [focusId, setFocusId] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(null);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
  }, [settings.lang]);

  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((id) => {
    window.location.hash = `/${id}`;
    setView(id);
    window.scrollTo({ top: 0 });
  }, []);

  const ctx = useScope({ accounts, trades, settings });
  const { tz } = ctx;

  const cursor = calendarCursor || cursorFor(ctx.stats.days.length ? ctx.stats.days[ctx.stats.days.length - 1].date : ctx.today);

  const accountBalances = useMemo(() => {
    const map = new Map();
    for (const a of accounts) {
      const adj = (a.adjustments || []).reduce((s, x) => s + Number(x.amount || 0), 0);
      const pnl = ctx.enrichedAll.filter((t) => t.accountId === a.id).reduce((s, t) => s + (Number(t.pnl) || 0), 0);
      map.set(a.id, a.startBalance + adj + pnl);
    }
    return map;
  }, [accounts, ctx.enrichedAll]);

  const tradeCounts = useMemo(() => {
    const map = new Map();
    for (const t of trades) map.set(t.accountId, (map.get(t.accountId) || 0) + 1);
    return map;
  }, [trades]);

  const knownSymbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))], [trades]);

  const onSaveTrade = (trade) => {
    if (form && form.trade) updateTrade(trade.id, trade);
    else addTrade(trade);
    setForm(null);
    if (view === "import") go("journal");
  };

  const onDeleteTrade = (t) => {
    if (window.confirm(tr("{s} {d} van {day} definitief verwijderen?", { s: t.symbol, d: t.direction, day: t.day }))) deleteTrade(t.id);
  };

  const pickDay = (date) => {
    setFilters({ ...EMPTY_FILTERS, day: date });
    setFocusId(null);
    go("trades");
  };

  const openTrade = (id) => {
    setFilters(EMPTY_FILTERS);
    setFocusId(id);
    go("trades");
  };

  const rawTrade = (t) => trades.find((x) => x.id === t.id) || t;

  if (!ready) {
    return (
      <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.textMuted }} className="flex items-center justify-center text-sm">
        {tr("Journal laden…")}
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text }} className="font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen size={22} color={COLORS.gold} />
            <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.gold, letterSpacing: "0.04em" }} className="text-lg min-[380px]:text-xl sm:text-2xl font-bold truncate">
              {tr("DCRAMERE JOURNAL")}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Segmented
              size="sm"
              value={settings.lang}
              onChange={(lang) => updateSettings({ lang })}
              ariaLabel="Taal / Language"
              options={[
                { value: "nl", label: "NL", raw: true },
                { value: "en", label: "EN", raw: true },
              ]}
            />
            <button
              type="button"
              onClick={() => setForm({})}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: COLORS.gold, color: "#0A0A0A" }}
            >
              <Plus size={14} /> <span>{tr("Trade")}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-label={tr("Hoe gebruik je dit?")}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold"
              style={{ color: showHelp ? COLORS.gold : COLORS.textMuted, border: `1px solid ${COLORS.cardBorder}` }}
            >
              <HelpCircle size={14} />
              <span className="hidden sm:inline">{tr("Hoe werkt dit?")}</span>
            </button>
          </div>
        </header>
        <div style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }} className="pb-3 mb-4">
          <p style={{ color: COLORS.textMuted }} className="text-xs tracking-widest">
            {tr("SEE · DECIPHER · TRADE")}
          </p>
        </div>

        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

        <nav aria-label={tr("Hoofdnavigatie")} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={active ? "page" : undefined}
                className="rounded-xl px-3 py-2.5 text-center"
                style={{
                  background: active ? COLORS.goldSoft : COLORS.card,
                  border: `1px solid ${active ? COLORS.gold : COLORS.cardBorder}`,
                }}
              >
                <div className="text-sm font-semibold" style={{ color: active ? COLORS.gold : COLORS.text }}>
                  {tr(t.title)}
                </div>
                <div className="text-[10px] hidden sm:block" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                  {tr(t.sub)}
                </div>
              </button>
            );
          })}
        </nav>

        {saveError && (
          <p role="alert" className="text-xs mb-3 rounded-lg px-3 py-2" style={{ color: COLORS.red, border: `1px solid ${COLORS.red}` }}>
            {tr("Opslaan in de browser is mislukt (opslag vol?). Download een back-up op het tabblad Import en verwijder oude screenshots.")}
          </p>
        )}

        {view !== "import" && <FilterBar accounts={accounts} settings={settings} onChange={updateSettings} tz={tz} />}

        {view === "journal" && (
          <JournalView ctx={ctx} settings={settings} onPickDay={pickDay} onOpenTrade={openTrade} calendarCursor={cursor} setCalendarCursor={setCalendarCursor} />
        )}
        {view === "trades" && (
          <TradesView
            ctx={ctx}
            accounts={accounts}
            filters={filters}
            setFilters={setFilters}
            focusId={focusId}
            tz={tz}
            allAccountTrades={ctx.accountTrades}
            onNew={() => setForm({})}
            onEdit={(t) => setForm({ trade: rawTrade(t) })}
            onDelete={onDeleteTrade}
          />
        )}
        {view === "stats" && <StatsView ctx={ctx} settings={settings} />}
        {view === "import" && <ImportView journal={journal} accountBalances={accountBalances} tradeCounts={tradeCounts} />}
      </div>

      {form && (
        <TradeForm
          accounts={accounts}
          defaultAccountId={settings.accountId !== "all" ? settings.accountId : undefined}
          initial={form.trade}
          tz={tz}
          knownSymbols={knownSymbols}
          onSave={onSaveTrade}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
