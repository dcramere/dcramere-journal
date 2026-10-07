import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS, MONO } from "../theme.js";
import { fixed, monthLong, monthShort, pct, unitValue, weekdayShort } from "../lib/format.js";
import { monthMatrix } from "../lib/tz.js";
import { Card, Segmented } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";

const METRICS = [
  { value: "pnl", label: "P&L" },
  { value: "trades", label: "Trades" },
  { value: "win", label: "Win %" },
  { value: "wl", label: "Gem. W/V" },
];

// Eén gedeelde weergave van een dag/maand-samenvatting voor de gekozen metriek.
function cell(summary, metric, unit) {
  if (!summary) return null;
  switch (metric) {
    case "trades":
      return { text: String(summary.trades), tone: summary.trades };
    case "win": {
      const total = summary.wins + summary.losses;
      const rate = total ? summary.wins / total : null;
      return { text: pct(rate), tone: rate == null ? 0 : rate - 0.5 };
    }
    case "wl": {
      const aw = summary.wins ? summary.grossWin / summary.wins : null;
      const al = summary.losses ? summary.grossLoss / summary.losses : null;
      const ratio = aw != null && al ? aw / al : null;
      return { text: ratio == null ? "—" : fixed(ratio, 2), tone: ratio == null ? 0 : ratio - 1 };
    }
    default:
      return { text: unitValue(summary.value ?? summary.net, unit, { dec: unit === "$" ? 0 : 2 }), tone: summary.value ?? summary.net };
  }
}

function toneStyle(metric, tone, scale) {
  if (metric === "trades") {
    return { border: COLORS.cardBorder, bg: COLORS.goldSoft, color: COLORS.gold };
  }
  if (!tone) return { border: COLORS.cardBorder, bg: COLORS.card, color: COLORS.text };
  const a = 0.12 + 0.3 * Math.min(1, Math.abs(tone) / (scale || 1));
  return tone > 0
    ? { border: "rgba(76,154,91,0.55)", bg: `rgba(76,154,91,${a})`, color: COLORS.green }
    : { border: "rgba(184,81,79,0.55)", bg: `rgba(184,81,79,${a})`, color: COLORS.red };
}

export function PnlCalendar({ stats, unit, cursor, setCursor, onPickDay }) {
  const [metric, setMetric] = useState("pnl");

  const byDate = useMemo(() => new Map(stats.days.map((d) => [d.date, d])), [stats.days]);
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.mo), [cursor]);
  const monthKey = `${cursor.y}-${String(cursor.mo).padStart(2, "0")}`;
  const monthDays = stats.days.filter((d) => d.month === monthKey);
  const monthNet = monthDays.reduce((s, d) => s + d.value, 0);
  const monthTrades = monthDays.reduce((s, d) => s + d.trades, 0);
  const scale = Math.max(1e-9, ...monthDays.map((d) => Math.abs(cell(d, metric, unit).tone)));

  const shift = (delta) => {
    const total = cursor.y * 12 + (cursor.mo - 1) + delta;
    setCursor({ y: Math.floor(total / 12), mo: (total % 12) + 1 });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} aria-label={tr("Naar vorige maand")} style={{ color: COLORS.textMuted }}>
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-base font-semibold first-letter:uppercase" style={{ color: COLORS.text }}>
            {monthLong(cursor.mo - 1)} {cursor.y}
          </h3>
          <button type="button" onClick={() => shift(1)} aria-label={tr("Volgende maand")} style={{ color: COLORS.textMuted }}>
            <ChevronRight size={18} />
          </button>
        </div>
        <Segmented size="sm" options={METRICS} value={metric} onChange={setMetric} ariaLabel={tr("Kalendermetriek")} />
      </div>
      <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
        {monthTrades
          ? tr(monthNet >= 0 ? "{n} trades, plus {v} in {m}." : "{n} trades, min {v} in {m}.", { n: monthTrades, v: unitValue(Math.abs(monthNet), unit), m: monthLong(cursor.mo - 1) })
          : tr("Geen trades in deze maand.")}
      </p>

      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr)) minmax(0,1.15fr)" }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => weekdayShort(i)).concat([tr("WEEK")]).map((d) => (
          <div
            key={d}
            className="text-center text-[9px] sm:text-[10px] py-1 rounded"
            style={{ color: COLORS.textMuted, background: COLORS.inputBg, fontFamily: MONO }}
          >
            {d}
          </div>
        ))}
        {weeks.flatMap((week, wi) => {
          const weekDays = week.map((d) => (d ? byDate.get(d) : null)).filter(Boolean);
          const weekNet = weekDays.reduce((s, d) => s + d.value, 0);
          const cells = week.map((date, di) => {
            if (!date) return <div key={`e${wi}-${di}`} />; const day = byDate.get(date); const c = day ? cell(day, metric, unit) : null; const st = c ? toneStyle(metric, c.tone, scale) : null; const num = Number(date.slice(8)); const content = (
              <>
                <span className="text-[9px] sm:text-[10px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                  {num}
                </span>
                {c && (
                  <span className="mt-auto text-right leading-tight">
                    <span className="block text-[10px] sm:text-sm font-bold" style={{ color: st.color }}>
                      {c.text}
                    </span>
                    {metric !== "trades" && (
                      <span className="hidden sm:block text-[9px] uppercase" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                        {tr(day.trades === 1 ? "{n} trade" : "{n} trades", { n: day.trades })}
                      </span>
                    )}
                  </span>
                )}
              </>
            );
            const base = {
              minHeight: 54,
              background: st ? st.bg : "transparent",
              border: `1px ${st ? "solid" : "dashed"} ${st ? st.border : COLORS.grid}`,
            };
            return day ? (
              <button
                key={date}
                type="button"
                onClick={() => onPickDay(date)}
                className="rounded-md p-1 sm:p-1.5 flex flex-col text-left"
                style={base}
                aria-label={`${date}: ${c.text}`}
              >
                {content}
              </button>
            ) : (
              <div key={date} className="rounded-md p-1 sm:p-1.5 flex flex-col" style={base}>
                {content}
              </div>
            );
          });
          const weekCell = (
            <div
              key={`w${wi}`}
              className="rounded-md p-1 sm:p-1.5 flex flex-col justify-center text-right"
              style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.grid}`, minHeight: 54 }}
            >
              {weekDays.length ? (
                <>
                  <span className="text-[10px] sm:text-sm font-bold" style={{ color: weekNet >= 0 ? COLORS.green : COLORS.red }}>
                    {unitValue(weekNet, unit, { dec: unit === "$" ? 0 : 2 })}
                  </span>
                  <span className="text-[9px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                    {tr(weekDays.length === 1 ? "{n} dag" : "{n} dagen", { n: weekDays.length })}
                  </span>
                </>
              ) : (
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  —
                </span>
              )}
            </div>
          );
          return [...cells, weekCell];
        })}
      </div>
    </Card>
  );
}

export function YearOverview({ stats, unit, onPickMonth }) {
  const latest = stats.months.length ? stats.months[stats.months.length - 1].month : null;
  const [year, setYear] = useState(latest ? Number(latest.slice(0, 4)) : new Date().getFullYear());
  const [metric, setMetric] = useState("pnl");
  const byMonth = new Map(stats.months.map((m) => [m.month, m]));
  const yearMonths = stats.months.filter((m) => m.month.startsWith(`${year}`));
  const scale = Math.max(1e-9, ...yearMonths.map((m) => Math.abs(cell(m, metric, unit).tone))); return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setYear((y) => y - 1)} aria-label={tr("Vorig jaar")} style={{ color: COLORS.textMuted }}>
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-base font-semibold" style={{ color: COLORS.text }}>
            {year}
          </h3>
          <button type="button" onClick={() => setYear((y) => y + 1)} aria-label={tr("Volgend jaar")} style={{ color: COLORS.textMuted }}>
            <ChevronRight size={18} />
          </button>
        </div>
        <Segmented size="sm" options={METRICS} value={metric} onChange={setMetric} ariaLabel={tr("Jaarmetriek")} />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2">
        {Array.from({ length: 12 }, (_, i) => monthShort(i)).map((label, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          const m = byMonth.get(key);
          const c = m ? cell(m, metric, unit) : null;
          const st = c ? toneStyle(metric, c.tone, scale) : null;
          const body = (
            <>
              <span className="text-[10px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                {label}
              </span>
              <span className="text-sm font-bold" style={{ color: c ? st.color : COLORS.textMuted }}>
                {c ? c.text : "—"}
              </span>
              <span className="text-[9px] uppercase" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                {m ? tr("{n} trades", { n: m.trades }) : tr("geen trades")}
              </span>
            </>
          );
          const style = {
            background: st ? st.bg : "transparent",
            border: `1px ${st ? "solid" : "dashed"} ${st ? st.border : COLORS.grid}`,
          };
          return m ? (
            <button key={key} type="button" onClick={() => onPickMonth(year, i + 1)} className="rounded-lg p-2 flex flex-col gap-0.5 text-left" style={style}>
              {body}
            </button>
          ) : (
            <div key={key} className="rounded-lg p-2 flex flex-col gap-0.5" style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
