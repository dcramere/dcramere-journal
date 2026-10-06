import React, { useEffect, useId, useRef, useState } from "react";
import { COLORS, MONO } from "../theme.js";
import { Empty } from "./primitives.jsx";
import { tr } from "../i18n.js";

// ---------- hulpjes ----------

export function niceTicks(min, max, count = 4) {
  let lo = min;
  let hi = max;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : Number(v.toFixed(10)));
  return ticks;
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = (width) => setW(Math.max(240, Math.round(width)));
    apply(el.clientWidth || 600);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function segments(values) {
  const runs = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else {
      cur.push({ i, v });
    }
  });
  if (cur.length) runs.push(cur);
  return runs;
}

const textStyle = { fontFamily: MONO, fontSize: 10 };

function Tooltip({ x, y, lines, boundsW, minX = 0 }) {
  const chars = Math.max(...lines.map((l) => l.text.length));
  const w = Math.min(boundsW - 8, chars * 5.9 + 16);
  const h = lines.length * 14 + 10;
  let bx = x + 12;
  if (bx + w > boundsW - 4) bx = x - 12 - w; bx = Math.max(minX + 2, bx); return (
    <g pointerEvents="none">
      <rect x={bx} y={y} width={w} height={h} rx={6} fill={COLORS.bg} stroke={COLORS.cardBorder} />
      {lines.map((l, i) => (
        <text key={i} x={bx + 8} y={y + 16 + i * 14} fill={l.color || COLORS.text} style={textStyle} fontWeight={i === 0 ? 700 : 400}>
          {l.text}
        </text>
      ))}
    </g>
  );
}

function pickIndexes(n, max = 5) {
  if (n <= 1) return [0];
  const m = Math.min(max, n);
  return [...new Set(Array.from({ length: m }, (_, k) => Math.round((k * (n - 1)) / (m - 1))))];
}

// ---------- Lijngrafiek ----------

export function LineChart({
  xs,
  series,
  yFormat,
  xFormat = (x) => x,
  height = 190,
  zero = true,
  refs = [],
  emptyText = "Nog geen data",
}) {
  const [wrapRef, W] = useWidth();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);
  const n = xs.length;

  const padL = 6;
  const padR = 64;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;

  const all = series
    .flatMap((s) => s.values)
    .filter((v) => v != null && Number.isFinite(v))
    .concat(refs.map((r) => r.value));
  let min = all.length ? Math.min(...all, zero ? 0 : Infinity) : 0;
  let max = all.length ? Math.max(...all, zero ? 0 : -Infinity) : 1;
  const ticks = niceTicks(min, max, 4);
  min = ticks[0];
  max = ticks[ticks.length - 1];

  const x = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * plotH; const baseY = min <= 0 && max >= 0 ? y(0) : padT + plotH;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = n === 1 ? 0 : Math.round(((px - 0) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const pills = series
    .map((s) => {
      const lastIdx = s.values.reduce((acc, v, i) => (v != null && Number.isFinite(v) ? i : acc), -1); if (lastIdx < 0 || s.pill === false) return null;
      const v = s.values[lastIdx];
      return { s, v, y: Math.max(padT + 8, Math.min(padT + plotH - 8, y(v))), text: (s.pillFormat || yFormat)(v) };
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y); for (let i = 1; i < pills.length; i += 1) {
    if (pills[i].y - pills[i - 1].y < 17) pills[i].y = pills[i - 1].y + 17;
  }

  return (
    <div ref={wrapRef} className="w-full">
      {!n ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <svg width={W} height={height} role="img" style={{ display: "block", maxWidth: "100%" }}>
          <defs>
            {series.map((s, k) => (
              <linearGradient key={k} id={`${gid}-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={COLORS.grid} strokeWidth="1" strokeDasharray={t === 0 ? "3 3" : "0"} />
              <text x={W - 4} y={y(t) + 3} textAnchor="end" fill={COLORS.textMuted} style={textStyle}>
                {yFormat(t)}
              </text>
            </g>
          ))}
          {refs.map((r, k) => (
            <line key={k} x1={padL} x2={W - padR} y1={y(r.value)} y2={y(r.value)} stroke={r.color || COLORS.textMuted} strokeDasharray="4 4" strokeWidth="1" />
          ))}

          {series.map((s, k) =>
            segments(s.values).map((run, r) => {
              const d = run.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
              const area = `${d} L${x(run[run.length - 1].i).toFixed(1)},${baseY} L${x(run[0].i).toFixed(1)},${baseY} Z`;
              return (
                <g key={`${k}-${r}`}>
                  {s.area && run.length > 1 && <path d={area} fill={`url(#${gid}-${k})`} />}
                  {run.length > 1 && (
                    <path
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={s.dashed ? "5 4" : undefined}
                    />
                  )}
                  {run.length === 1 && <circle cx={x(run[0].i)} cy={y(run[0].v)} r="3.5" fill={s.color} />}
                </g>
              );
            })
          )}

          {pickIndexes(n).map((i, k, arr) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={k === 0 && arr.length > 1 ? "start" : k === arr.length - 1 && arr.length > 1 ? "end" : "middle"}
              fill={COLORS.textMuted}
              style={textStyle}
            >
              {xFormat(xs[i])}
            </text>
          ))}

          {pills.map((p) => (
            <g key={p.s.name} pointerEvents="none">
              <rect
                x={W - padR + 4}
                y={p.y - 8}
                width={Math.max(30, p.text.length * 6 + 10)}
                height={16}
                rx={8}
                fill={COLORS.bg}
                stroke={p.s.color}
              />
              <text x={W - padR + 9} y={p.y + 3.5} fill={p.s.color} style={textStyle} fontWeight={700}>
                {p.text}
              </text>
            </g>
          ))}

          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke={COLORS.textMuted} strokeDasharray="2 3" />
              {series.map((s, k) =>
                s.values[hover] != null ? <circle key={k} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke={COLORS.bg} strokeWidth="1.5" /> : null
              )}
              <Tooltip
                x={x(hover)}
                y={padT + 2}
                boundsW={W - padR}
                lines={[
                  { text: String(xFormat(xs[hover])) },
                  ...series
                    .filter((s) => s.values[hover] != null)
                    .map((s) => ({ text: `${tr(s.name)}: ${(s.pillFormat || yFormat)(s.values[hover])}`, color: s.color })),
                ]}
              />
            </g>
          )}

          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ touchAction: "pan-y", cursor: "crosshair" }}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
    </div>
  );
}

// ---------- Staafgrafiek ----------

export function BarChart({ items, yFormat, height = 190, emptyText = "Nog geen data" }) {
  const [wrapRef, W] = useWidth();
  const [hover, setHover] = useState(null);
  const n = items.length;
  const padL = 6;
  const padR = 52;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;

  const vals = items.map((i) => i.value);
  const ticks = niceTicks(Math.min(0, ...vals, 0), Math.max(0, ...vals, 0), 4);
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const y = (v) => padT + (1 - (v - min) / (max - min)) * plotH; const slot = n ? plotW / n : 0; const bw = Math.max(3, Math.min(34, slot * 0.62)); return (
    <div ref={wrapRef} className="w-full">
      {!n ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <svg width={W} height={height} role="img" style={{ display: "block", maxWidth: "100%" }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={COLORS.grid} strokeDasharray={t === 0 ? "3 3" : "0"} />
              <text x={W - 4} y={y(t) + 3} textAnchor="end" fill={COLORS.textMuted} style={textStyle}>
                {yFormat(t)}
              </text>
            </g>
          ))}
          {items.map((it, i) => {
            const cx = padL + slot * i + slot / 2;
            const top = y(Math.max(it.value, 0));
            const bottom = y(Math.min(it.value, 0));
            const color = it.value >= 0 ? COLORS.green : COLORS.red; return (
              <rect
                key={it.key ?? i}
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1.5, bottom - top)}
                rx={2}
                fill={color}
                opacity={hover == null || hover === i ? 1 : 0.55}
              />
            );
          })}
          {pickIndexes(n, 6).map((i, k, arr) => (
            <text
              key={i}
              x={padL + slot * i + slot / 2}
              y={height - 6}
              textAnchor={k === 0 && arr.length > 1 ? "start" : k === arr.length - 1 && arr.length > 1 ? "end" : "middle"}
              fill={COLORS.textMuted}
              style={textStyle}
            >
              {items[i].label}
            </text>
          ))}
          {hover != null && (
            <Tooltip
              x={padL + slot * hover + slot / 2}
              y={padT + 2}
              boundsW={W - padR}
              lines={[
                { text: items[hover].label },
                { text: yFormat(items[hover].value), color: items[hover].value >= 0 ? COLORS.green : COLORS.red },
                ...(items[hover].sub ? [{ text: items[hover].sub, color: COLORS.textMuted }] : []),
              ]}
            />
          )}
          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ touchAction: "pan-y" }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - rect.left) / slot))));
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
    </div>
  );
}

// ---------- Puntenwolk ----------

export function DotPlot({ points, xTicks, xDomain, yFormat, height = 190, emptyText = "Nog geen data" }) {
  const [wrapRef, W] = useWidth();
  const [hover, setHover] = useState(null);
  const padL = 6;
  const padR = 52;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const vals = points.map((p) => p.y);
  const ticks = niceTicks(Math.min(0, ...vals, 0), Math.max(0, ...vals, 0), 4);
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const [x0, x1] = xDomain;
  const px = (v) => padL + ((v - x0) / (x1 - x0 || 1)) * plotW;
  const py = (v) => padT + (1 - (v - min) / (max - min)) * plotH; return (
    <div ref={wrapRef} className="w-full">
      {!points.length ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <svg width={W} height={height} role="img" style={{ display: "block", maxWidth: "100%" }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={py(t)} y2={py(t)} stroke={COLORS.grid} strokeDasharray={t === 0 ? "3 3" : "0"} />
              <text x={W - 4} y={py(t) + 3} textAnchor="end" fill={COLORS.textMuted} style={textStyle}>
                {yFormat(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t.label} x={px(t.v)} y={height - 6} textAnchor="middle" fill={COLORS.textMuted} style={textStyle}>
              {t.label}
            </text>
          ))}
          {points.map((p, i) => (
            <circle
              key={p.id ?? i}
              cx={px(p.x)}
              cy={py(p.y)}
              r={hover === i ? 5 : 3.5}
              fill={p.y >= 0 ? COLORS.green : COLORS.red}
              opacity={0.85}
            />
          ))}
          {hover != null && (
            <Tooltip
              x={px(points[hover].x)}
              y={padT + 2}
              boundsW={W - padR}
              lines={[{ text: points[hover].label }, { text: yFormat(points[hover].y), color: points[hover].y >= 0 ? COLORS.green : COLORS.red }]}
            />
          )}
          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ touchAction: "pan-y" }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mx = e.clientX - rect.left + padL;
              const my = e.clientY - rect.top + padT;
              let best = null;
              let bestD = 18 * 18;
              points.forEach((p, i) => {
                const d = (px(p.x) - mx) ** 2 + (py(p.y) - my) ** 2;
                if (d < bestD) {
                  bestD = d;
                  best = i;
                }
              });
              setHover(best);
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
    </div>
  );
}

// ---------- Donut ----------

export function Donut({ parts, size = 54, thickness = 7 }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1; let offset = 0; return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.grid} strokeWidth={thickness} />
      {parts.map((p, i) => {
        const len = (p.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={thickness}
            strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

// ---------- Horizontale balken (HTML) ----------

export function HBars({ rows, mode = "diverging", labelWidth = "w-36" }) {
  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value))); return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = (Math.abs(r.value) / maxAbs) * (mode === "diverging" ? 50 : 100);
        const positive = r.value >= 0; const color = r.color || (mode === "fill" ? COLORS.gold : positive ? COLORS.green : COLORS.red); return (
          <div key={r.key ?? r.label} className="flex items-center gap-2 text-xs">
            <div className={`${labelWidth} shrink-0 truncate`} style={{ color: COLORS.textMuted }} title={r.label}>
              {r.label} {r.sub != null && <span className="opacity-60">({r.sub})</span>}
            </div>
            <div className="flex-1 relative h-4 rounded" style={{ background: COLORS.inputBg }}>
              {mode === "diverging" && (
                <div className="absolute top-0 bottom-0" style={{ left: "50%", width: 1, background: COLORS.cardBorder }} />
              )}
              <div
                className="absolute top-0 bottom-0 rounded"
                style={{
                  background: color,
                  left: mode === "diverging" ? (positive ? "50%" : `${50 - pct}%`) : 0,
                  width: `${pct}%`,
                }}
              />
            </div>
            <div className="w-20 shrink-0 text-right font-semibold" style={{ color: mode === "fill" ? COLORS.gold : color, fontFamily: MONO }}>
              {r.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Jaaroverzicht (12 kolommen × 31 dagen) ----------

export function YearGrid({ year, days }) {
  const byDate = new Map(days.map((d) => [d.date, d.value]));
  const maxAbs = Math.max(1e-9, ...days.map((d) => Math.abs(d.value)));
  const months = Array.from({ length: 12 }, (_, i) => i);
  const dim = (m) => new Date(Date.UTC(year, m + 1, 0)).getUTCDate(); const label = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]; return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
      {months.map((m) => (
        <div key={m} className="flex flex-col gap-[3px] items-center">
          <span className="text-[9px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
            {label[m]}
          </span>
          {Array.from({ length: 31 }, (_, d) => {
            if (d >= dim(m)) return <span key={d} style={{ width: "100%", maxWidth: 16, aspectRatio: "1" }} />;
            const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
            const v = byDate.get(date);
            const a = v == null ? 0 : 0.25 + 0.75 * (Math.abs(v) / maxAbs);
            const bg = v == null ? COLORS.grid : v >= 0 ? `rgba(76,154,91,${a})` : `rgba(184,81,79,${a})`;
            return (
              <span
                key={d}
                title={v == null ? date : `${date}: ${v.toFixed(2)}`}
                style={{ width: "100%", maxWidth: 16, aspectRatio: "1", borderRadius: 3, background: bg, opacity: v == null ? 0.5 : 1 }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
