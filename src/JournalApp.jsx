import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, HelpCircle, LogOut, Plus, Users } from "lucide-react";
import { COLORS, MONO } from "./theme.js";
import { useScope } from "./state/useScope.js";
import { FilterBar } from "./components/FilterBar.jsx";
import { TradeForm } from "./components/TradeForm.jsx";
import HelpPanel from "./HelpPanel.jsx";
import { JournalView, cursorFor } from "./views/JournalView.jsx";
import { TradesView } from "./views/TradesView.jsx";
import { StatsView } from "./views/StatsView.jsx";
import { ImportView } from "./views/ImportView.jsx";
import { ReportsView } from "./views/ReportsView.jsx";
import { useReports } from "./state/useReports.js";
import { setLang, tr } from "./i18n.js";
import { Segmented } from "./ui/primitives.jsx";
import { MigrateLocal } from "./components/MigrateLocal.jsx";
import { PrivacyCard } from "./components/PrivacyCard.jsx";

const TABS = [
  { id: "import", title: "Import", sub: "Trades en accounts" },
  { id: "journal", title: "Journal", sub: "Je recente trades" },
  { id: "trades", title: "Trades", sub: "Lijst van trades" },
  { id: "stats", title: "Stats", sub: "Je prestaties" },
  { id: "reports", title: "Rapport", sub: "Wat goed gaat" },
];

const EMPTY_FILTERS = { q: "", day: null, direction: "all", result: "all", setup: "all", mood: "all" };

// De journal-shell: tabs, filters en de vier weergaven. Werkt op een lokaal journal,
// op het eigen server-journal, en alleen-lezen op het journal van een klant (beheerder).
export default function JournalApp({ journal, user = null, tab, basePath = "", readOnly = false, banner = null, isAdmin = false, onLogout, onLang, rootLang, onAccountDeleted }) {
  const { accounts, trades, settings, saveError, updateSettings, addTrade, updateTrade, deleteTrade } = journal;
  const lang = readOnly ? rootLang : settings.lang;
  setLang(lang);

  const tabs = readOnly ? TABS.filter((t) => t.id !== "import") : TABS;
  const view = tabs.some((t) => t.id === tab) ? tab : "journal";
  const reportData = useReports(journal, view === "reports");
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState(null); // null | { trade?: enrichedTrade }
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [focusId, setFocusId] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (!readOnly && onLang) onLang(settings.lang);
  }, [lang, readOnly, settings.lang, onLang]);

  const go = useCallback(
    (id) => {
      window.location.hash = `${basePath}/${id}`;
      window.scrollTo({ top: 0 });
    },
    [basePath]
  );

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

  const onSaveTrade = (trade) => (form && form.trade ? updateTrade(trade.id, trade) : addTrade(trade));
  const onTradeSaved = () => {
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
              value={lang}
              onChange={(next) => (readOnly ? onLang(next) : updateSettings({ lang: next }))}
              ariaLabel="Taal / Language"
              options={[
                { value: "nl", label: "NL", raw: true },
                { value: "en", label: "EN", raw: true },
              ]}
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => setForm({})}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ background: COLORS.gold, color: "#0A0A0A" }}
              >
                <Plus size={14} /> <span>{tr("Trade")}</span>
              </button>
            )}
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
        <div style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }} className="pb-3 mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p style={{ color: COLORS.textMuted }} className="text-xs tracking-widest">
            {tr("SEE · DECIPHER · TRADE")}
          </p>
          {user && (
            <div className="flex items-center gap-3 text-[11px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
              <span className="truncate max-w-[40vw]">{user.name}</span>
              {isAdmin && (
                <a href="#/admin" className="inline-flex items-center gap-1" style={{ color: COLORS.gold }}>
                  <Users size={12} /> {tr("Klanten")}
                </a>
              )}
              <button type="button" onClick={onLogout} className="inline-flex items-center gap-1" aria-label={tr("Uitloggen")}>
                <LogOut size={12} /> {tr("Uitloggen")}
              </button>
            </div>
          )}
        </div>

        {banner && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 mb-4 text-xs"
            style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.gold}`, color: COLORS.text }}
          >
            <span>{banner}</span>
            <a href="#/admin" className="inline-flex items-center gap-1 font-semibold" style={{ color: COLORS.gold }}>
              <ArrowLeft size={12} /> {tr("Terug naar klanten")}
            </a>
          </div>
        )}

        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

        {journal.mode === "server" && !readOnly && user && <MigrateLocal user={user} journal={journal} />}

        <nav aria-label={tr("Hoofdnavigatie")} className={`grid gap-2 mb-4 ${{ 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-5" }[tabs.length]}`}>
          {tabs.map((t) => {
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
            {journal.mode === "server"
              ? tr("Opslaan op de server is mislukt. Controleer je verbinding; je scherm is gelijkgetrokken met de server.")
              : tr("Opslaan in de browser is mislukt (opslag vol?). Download een back-up op het tabblad Import en verwijder oude screenshots.")}
          </p>
        )}

        {view !== "import" && view !== "reports" && <FilterBar accounts={accounts} settings={settings} onChange={updateSettings} tz={tz} />}

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
            readOnly={readOnly}
          />
        )}
        {view === "stats" && <StatsView ctx={ctx} settings={settings} />}
        {view === "reports" && <ReportsView reports={reportData.reports} loading={reportData.loading} error={reportData.error} name={readOnly ? journal.owner?.name : null} />}
        {view === "import" && (
          <ImportView
            journal={journal}
            accountBalances={accountBalances}
            tradeCounts={tradeCounts}
            footer={journal.mode === "server" && user ? <PrivacyCard user={user} onDeleted={onAccountDeleted} /> : null}
          />
        )}
      </div>

      {form && !readOnly && (
        <TradeForm
          accounts={accounts}
          defaultAccountId={settings.accountId !== "all" ? settings.accountId : undefined}
          initial={form.trade}
          tz={tz}
          knownSymbols={knownSymbols}
          onSave={onSaveTrade}
          onDone={onTradeSaved}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
