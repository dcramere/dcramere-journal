import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Target } from "lucide-react";
import { COLORS, MONO, toneColor } from "../theme.js";
import { tr } from "../i18n.js";
import { fixed, money, pct } from "../lib/format.js";
import { focusText, habitText, headlineText, insightText, periodLabel, previousLabel, reportShareText } from "../lib/reportText.js";
import { Button, Card, Empty, Segmented, Select } from "../ui/primitives.jsx";

const usd = (v) => money(v, { sign: true, dec: 0 });

function Tile({ label, value, sub, color }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.grid}` }}>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {label}
      </div>
      <div className="text-lg font-bold" style={{ color: color || COLORS.text }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px]" style={{ color: COLORS.textMuted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, tone, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: tone }}>
        {icon}
        {title}
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

const Item = ({ children, color }) => (
  <li className="text-xs leading-relaxed pl-3" style={{ color: COLORS.text, borderLeft: `2px solid ${color}` }}>
    {children}
  </li>
);

// Eén rapportkaart: kerncijfers, wat goed gaat, wat beter kan en de focus voor de volgende periode.
export function ReportCard({ report, name, onShare }) {
  const d = report.data;
  const k = d.kpis;
  const kind = d.kind;
  const habit = d.habit;
  const [copied, setCopied] = useState(false);
  const label = periodLabel(kind, report.periodKey, report.periodStart, report.periodEnd);
  const goodItems = d.good.map((i) => insightText(i, kind));
  const improveItems = d.improve.map((i) => insightText(i, kind));
  const prevText = d.prev ? tr("{prev}: {usd}", { prev: previousLabel(kind), usd: usd(d.prev.net) }) : tr("Geen {prev} om mee te vergelijken", { prev: previousLabel(kind) });

  const text = () => reportShareText(report, { name, label: kind === "week" ? tr("Weekrapport {label}", { label }) : tr("Maandrapport {label}", { label }) });

  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold" style={{ color: COLORS.text }}>
          {label}
        </h3>
        <div className="flex gap-2">
          <Button onClick={copy}>{copied ? tr("Gekopieerd") : tr("Kopieer als tekst")}</Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text())}`}
            target="_blank"
            rel="noreferrer"
            onClick={onShare}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
          >
            {tr("Deel via WhatsApp")}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Tile label={tr("Resultaat")} value={usd(k.net)} sub={`${fixed(k.netR, 2, { sign: true })}R · ${prevText}`} color={toneColor(k.net)} />
        <Tile label={tr("Trades")} value={k.trades} sub={tr("{w} winst · {l} verlies", { w: k.wins, l: k.losses })} />
        <Tile
          label={tr("Win %")}
          value={pct(k.winRate)}
          sub={k.neededWinRate != null ? tr("Nodig: {v}", { v: pct(k.neededWinRate) }) : undefined}
          color={k.winRate != null && k.neededWinRate != null && k.winRate >= k.neededWinRate ? COLORS.green : undefined}
        />
        <Tile
          label={tr("Profit factor")}
          value={k.profitFactor == null ? "—" : fixed(k.profitFactor, 2)}
          sub={tr("{d} handelsdagen, {g} groen", { d: k.tradingDays, g: k.greenDays })}
          color={k.profitFactor != null && k.profitFactor > 1 ? COLORS.green : undefined}
        />
      </div>

      {d.headline && (
        <p className="text-sm font-semibold mb-4" style={{ color: COLORS.text }}>
          {headlineText(d.headline, kind)}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {d.neutral.map((i) => (
          <div key={i.id} className="flex items-start gap-2 text-xs" style={{ color: COLORS.textMuted }}>
            <Info size={14} className="shrink-0 mt-0.5" />
            {insightText(i, kind)}
          </div>
        ))}

        <Section icon={<CheckCircle2 size={16} />} title={tr("Wat gaat goed")} tone={COLORS.green}>
          {goodItems.length === 0 && !(habit && habit.tone === "good") && <Item color={COLORS.grid}>{tr("Nog geen duidelijke sterke punten in deze periode.")}</Item>}
          {goodItems.map((t, i) => (
            <Item key={i} color={COLORS.green}>
              {t}
            </Item>
          ))}
          {habit && habit.tone === "good" && <Item color={COLORS.green}>{habitText(habit)}</Item>}
        </Section>

        <Section icon={<AlertTriangle size={16} />} title={tr("Waar kun je verbeteren")} tone={COLORS.gold}>
          {improveItems.length === 0 && !(habit && habit.tone === "improve") && <Item color={COLORS.grid}>{tr("Geen duidelijke zwakke punten gevonden. Goed bezig.")}</Item>}
          {improveItems.map((t, i) => (
            <Item key={i} color={COLORS.gold}>
              {t}
            </Item>
          ))}
          {habit && habit.tone === "improve" && <Item color={COLORS.gold}>{habitText(habit)}</Item>}
        </Section>

        <div className="rounded-lg px-3 py-3 flex items-start gap-2" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.gold}` }}>
          <Target size={16} color={COLORS.gold} className="shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: COLORS.gold, fontFamily: MONO }}>
              {kind === "week" ? tr("Focus voor de komende week") : tr("Focus voor de komende maand")}
            </div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: COLORS.text }}>
              {focusText(d.focus, kind)}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ReportsView({ reports, loading, error, name }) {
  const [kind, setKind] = useState("week");
  const list = useMemo(() => reports.filter((r) => r.kind === kind), [reports, kind]);
  const [selected, setSelected] = useState(null);
  const current = list.find((r) => r.id === selected) || list[0];

  useEffect(() => setSelected(null), [kind]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={kind}
          onChange={setKind}
          ariaLabel={tr("Soort rapport")}
          options={[
            { value: "week", label: "Wekelijks" },
            { value: "month", label: "Maandelijks" },
          ]}
        />
        {list.length > 1 && (
          <Select
            label={tr("Periode")}
            value={current ? current.id : ""}
            onChange={setSelected}
            options={list.map((r) => ({ value: r.id, label: periodLabel(r.kind, r.periodKey, r.periodStart, r.periodEnd), raw: true }))}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ color: COLORS.red }}>
          {error}
        </p>
      )}

      {loading && !current ? (
        <Card>
          <Empty>{tr("Rapporten laden…")}</Empty>
        </Card>
      ) : !current ? (
        <Card>
          <Empty>{tr("Nog geen rapport. Een rapport verschijnt zodra een week of maand is afgesloten en je daarin trades hebt gelogd.")}</Empty>
        </Card>
      ) : (
        <ReportCard key={current.id} report={current} name={name} />
      )}

      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        {tr("Het rapport wordt automatisch berekend uit je gelogde trades. Hoe meer trades je logt (en hoe vaker je je emotie invult), hoe betrouwbaarder de conclusies.")}
      </p>
    </div>
  );
}
