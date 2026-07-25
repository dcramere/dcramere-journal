import React, { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { COLORS } from "./theme.js";

function EquityCurve({ points }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const width = 600;
  const height = 200;
  const padL = 12;
  const padR = 54;
  const padT = 24;
  const padB = 20;
  const n = points.length;

  const cums = points.map((p) => p.cum);
  let yMin = Math.min(0, ...cums);
  let yMax = Math.max(0, ...cums);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  function x(i) {
    if (n <= 1) return (padL + (width - padR)) / 2;
    return padL + (i / (n - 1)) * (width - padL - padR);
  }
  function y(v) {
    return padT + (1 - (v - yMin) / (yMax - yMin)) * (height - padT - padB);
  }

  const zeroY = y(0);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.cum)}`).join(" ");
  const areaPath = n > 1 ? `${linePath} L${x(n - 1)},${zeroY} L${x(0)},${zeroY} Z` : "";

  const last = points[n - 1];
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }} className="rounded-lg p-4">
      <p className="text-xs font-semibold mb-2" style={{ color: COLORS.text }}>
        Equity curve (cumulatieve R)
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.28" />
            <stop offset="100%" stopColor={COLORS.gold} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={padL}
          y1={zeroY}
          x2={width - padR}
          y2={zeroY}
          stroke={COLORS.cardBorder}
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {n > 1 && <path d={areaPath} fill="url(#equityFill)" stroke="none" />}
        {n > 1 && (
          <path d={linePath} fill="none" stroke={COLORS.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <g key={p.i}>
            <circle
              cx={x(i)}
              cy={y(p.cum)}
              r="10"
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => setHoverIdx(hoverIdx === i ? null : i)}
              style={{ cursor: "pointer" }}
            />
            <circle
              cx={x(i)}
              cy={y(p.cum)}
              r={hoverIdx === i ? 4.5 : 2.5}
              fill={p.r >= 0 ? COLORS.green : COLORS.red}
              stroke={COLORS.bg}
              strokeWidth="1"
              pointerEvents="none"
            />
          </g>
        ))}

        {last && (
          <text
            x={x(n - 1) + 6}
            y={y(last.cum)}
            fill={last.cum >= 0 ? COLORS.green : COLORS.red}
            fontSize="12"
            fontWeight="700"
            dominantBaseline="middle"
          >
            {last.cum >= 0 ? "+" : ""}
            {last.cum.toFixed(2)}R
          </text>
        )}

        {hovered &&
          (() => {
            const hx = x(hoverIdx);
            const hy = y(hovered.cum);
            const anchorLeft = hx > width - 150;
            const boxW = 128;
            const boxX = anchorLeft ? hx - boxW - 10 : hx + 10;
            const boxY = Math.max(4, hy - 34);
            return (
              <g pointerEvents="none">
                <rect x={boxX} y={boxY} width={boxW} height="40" rx="4" fill={COLORS.bg} stroke={COLORS.cardBorder} />
                <text x={boxX + 8} y={boxY + 15} fill={COLORS.text} fontSize="10" fontWeight="700">
                  {hovered.symbol} · {hovered.date}
                </text>
                <text x={boxX + 8} y={boxY + 30} fill={COLORS.textMuted} fontSize="10">
                  Trade: {hovered.r >= 0 ? "+" : ""}
                  {hovered.r.toFixed(2)}R · Cum: {hovered.cum >= 0 ? "+" : ""}
                  {hovered.cum.toFixed(2)}R
                </text>
              </g>
            );
          })()}
      </svg>
    </div>
  );
}

function MoodChart({ data }) {
  const maxAbs = Math.max(0.01, ...data.map((d) => Math.abs(d.avg)));
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }} className="rounded-lg p-4">
      <p className="text-xs font-semibold mb-3" style={{ color: COLORS.text }}>
        Gem. R per emotionele toestand
      </p>
      <div className="flex flex-col gap-2">
        {data.map((d) => {
          const pct = (Math.abs(d.avg) / maxAbs) * 50;
          const positive = d.avg >= 0;
          return (
            <div key={d.mood} className="flex items-center gap-2 text-xs">
              <div className="w-28 shrink-0 truncate" style={{ color: COLORS.textMuted }} title={d.mood}>
                {d.mood} <span className="opacity-60">(n={d.count})</span>
              </div>
              <div className="flex-1 relative h-4 rounded" style={{ background: COLORS.inputBg }}>
                <div className="absolute top-0 bottom-0" style={{ left: "50%", width: 1, background: COLORS.cardBorder }} />
                <div
                  className="absolute top-0 bottom-0 rounded"
                  style={{
                    background: positive ? COLORS.green : COLORS.red,
                    left: positive ? "50%" : `${50 - pct}%`,
                    width: `${pct}%`,
                  }}
                />
              </div>
              <div className="w-16 shrink-0 text-right font-semibold" style={{ color: positive ? COLORS.green : COLORS.red }}>
                {positive ? "+" : ""}
                {d.avg.toFixed(2)}R
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetupChart({ data }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }} className="rounded-lg p-4">
      <p className="text-xs font-semibold mb-3" style={{ color: COLORS.text }}>
        Win rate per reden (Handelsweg-stap)
      </p>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.setup} className="flex items-center gap-2 text-xs">
            <div className="w-32 shrink-0 truncate" style={{ color: COLORS.textMuted }} title={d.setup}>
              {d.setup} <span className="opacity-60">(n={d.count})</span>
            </div>
            <div className="flex-1 h-4 rounded" style={{ background: COLORS.inputBg }}>
              <div className="h-4 rounded" style={{ width: `${d.winRate * 100}%`, background: COLORS.gold }} />
            </div>
            <div className="w-12 shrink-0 text-right font-semibold" style={{ color: COLORS.gold }}>
              {Math.round(d.winRate * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Insights({ entries }) {
  const equityPoints = useMemo(() => {
    const chronological = [...entries].reverse();
    let cum = 0;
    return chronological.map((e, i) => {
      cum += Number(e.result);
      return { i, date: e.date, symbol: e.symbol, r: Number(e.result), cum };
    });
  }, [entries]);

  const moodStats = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      if (!e.mood) return;
      if (!map.has(e.mood)) map.set(e.mood, { mood: e.mood, count: 0, sum: 0 });
      const m = map.get(e.mood);
      m.count += 1;
      m.sum += Number(e.result);
    });
    return Array.from(map.values())
      .map((m) => ({ ...m, avg: m.sum / m.count }))
      .sort((a, b) => b.avg - a.avg);
  }, [entries]);

  const setupStats = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      if (!map.has(e.setup)) map.set(e.setup, { setup: e.setup, count: 0, wins: 0 });
      const s = map.get(e.setup);
      s.count += 1;
      if (Number(e.result) > 0) s.wins += 1;
    });
    return Array.from(map.values())
      .map((s) => ({ ...s, winRate: s.wins / s.count }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-8">
      <h2 style={{ color: COLORS.text }} className="text-sm font-semibold flex items-center gap-2">
        <LineChart size={16} color={COLORS.gold} />
        Inzichten &amp; patronen
      </h2>
      {entries.length < 5 && (
        <p style={{ color: COLORS.textMuted }} className="text-xs -mt-3">
          Log meer trades (5+) voor betrouwbaardere patronen.
        </p>
      )}
      <EquityCurve points={equityPoints} />
      {moodStats.length > 0 && <MoodChart data={moodStats} />}
      {setupStats.length > 0 && <SetupChart data={setupStats} />}
    </div>
  );
}
