import React, { useState } from "react";
import { ArrowDown, ArrowUp, EyeOff } from "lucide-react";
import { COLORS, MONO, PERIODS, toneColor } from "../theme.js";
import { PnlCalendar, YearOverview } from "../components/PnlCalendar.jsx";
import { axisValue, dateOnlyLabel, duration, fixed, money, pct, shortDate, unitValue } from "../lib/format.js";
import { parseDate } from "../lib/tz.js";
import { BarChart, DotPlot, Donut, HBars, LineChart } from "../ui/charts.jsx";
import { Card, CardTitle, Empty } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";
import { LayoutBar } from "../components/LayoutBar.jsx";
import { DEFAULT_ORDER, addWidget, hideWidget, loadState, moveWidget, orderFor, persistState, removeLayout, saveAs } from "../lib/layout.js";

export function periodTag(period) {
  return tr(PERIODS.find((p) => p.value === period)?.label || "").toUpperCase();
}

function Kpi({ title, help, tag, value, tone, sub, children, footer }) {
  return (
    <Card tone={tone}>
      <CardTitle title={title} help={help} tag={tag} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-2xl sm:text-3xl font-bold truncate" style={{ color: tone === "pos" ? COLORS.green : tone === "neg" ? COLORS.red : COLORS.text }}>
            {value}
          </div>
          {sub && (
            <div className="text-xs mt-1" style={{ color: tone === "pos" ? COLORS.green : COLORS.textMuted }}>
              {sub}
            </div>
          )}
        </div>
        {children}
      </div>
      {footer}
    </Card>
  );
}

function SplitBar({ left, right, leftColor, rightColor }) {
  const total = left + right || 1;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden mt-3 gap-0.5" style={{ background: COLORS.grid }}>
      <div style={{ width: `${(left / total) * 100}%`, background: leftColor }} />
      <div style={{ width: `${(right / total) * 100}%`, background: rightColor }} />
    </div>
  );
}

function Chip({ children, color = COLORS.textMuted }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: COLORS.inputBg, color, fontFamily: MONO }}>
      {children}
    </span>
  );
}

function holdTicks(maxMin) {
  const all = [5, 15, 30, 60, 120, 240, 480];
  const ticks = all.filter((m) => m <= maxMin * 1.05).slice(-5);
  return ticks.map((m) => ({ v: m, label: m >= 60 ? `${m / 60}U` : `${m}M` }));
}

// Elke widget: id (zie lib/layout.js), label voor de lijst "voeg een widget toe", breedte en weergave.
// `full` = hele rij, `kpi` = klein kerncijfer, anders een grafiekkaart.
function buildWidgets(env) {
  const { stats, unit, balance, tag, dates, xFmt, fmtAxis, recent, moodRows, netTone, maxHold, hMin, hMax, dd, onPickDay, onOpenTrade, setCalendarCursor, calendarCursor } = env;
  const money2 = (v) => unitValue(v, unit, { sign: true });
  return {
    balance: {
      label: "Saldo & P&L",
      size: "kpi",
      render: () => (
        <Kpi
          title={tr("Saldo & P&L")}
          help={tr("Dit is wat je in de gekozen periode won of verloor, na kosten. Het kleinere bedrag is je accountsaldo: het startsaldo plus alles wat je verdiende, stortte of opnam, tot het einde van de periode.")}
          tag={tag}
          value={money2(stats.net)}
          tone={netTone}
          sub={tr("Saldo {v}", { v: money(balance.end) })}
        />
      ),
    },
    winPct: {
      label: "Win %",
      size: "kpi",
      render: () => (
        <Kpi
          title={tr("Win %")}
          help={tr("Dit is het aandeel van je gesloten trades dat met winst eindigde. De drie aantallen zijn winnaars, breakeven en verliezers. De kleur volgt je totale resultaat, niet alleen het percentage: een laag percentage met grote winnaars kan toch groen zijn.")}
          tag={tag}
          value={pct(stats.winRate)}
          tone={netTone}
          sub={stats.neededWinRate != null ? tr("Nodig: {v}", { v: pct(stats.neededWinRate) }) : undefined}
          footer={
            stats.trades > 0 && (
              <>
                <SplitBar left={stats.wins} right={stats.losses} leftColor={COLORS.green} rightColor={COLORS.red} />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <Chip color={COLORS.green}>{stats.wins}</Chip>
                  <Chip>{stats.be}</Chip>
                  <Chip color={COLORS.red}>{stats.losses}</Chip>
                </div>
              </>
            )
          }
        />
      ),
    },
    avgWinLoss: {
      label: "Gem. winst / gem. verlies",
      size: "kpi",
      render: () => (
        <Kpi
          title={tr("Gem. winst / gem. verlies")}
          help={
            stats.avgWin != null && stats.avgLoss != null
              ? tr("Dit deelt je gemiddelde winnaar door je gemiddelde verliezer: {w} tegen {l}. De kleur volgt je totale resultaat, niet alleen de verhouding: onder 1,00 blijft groen als je winrate het draagt.", {
                  w: unitValue(stats.avgWin, unit),
                  l: unitValue(stats.avgLoss, unit),
                })
              : tr("Dit deelt je gemiddelde winnaar door je gemiddelde verliezer. Je hebt allebei nodig om dit te zien.")
          }
          tag={tag}
          value={fixed(stats.ratio, 2)}
          tone={netTone}
          sub={
            stats.avgWin != null || stats.avgLoss != null
              ? `${money2(stats.avgWin)} / ${unitValue(stats.avgLoss != null ? -stats.avgLoss : null, unit)}`
              : undefined
          }
        />
      ),
    },
    profitFactor: {
      label: "Profit factor",
      size: "kpi",
      render: () => (
        <Kpi
          title={tr("Profit factor")}
          help={tr("Dit deelt je bruto winst door je bruto verlies: boven 1,00 wegen je winnaars zwaarder dan je verliezers. De ring tekent hetzelfde: groen is wat winnaars opleverden, rood wat verliezers kostten.")}
          tag={tag}
          value={stats.profitFactor == null ? "—" : fixed(stats.profitFactor, 2)}
          tone={stats.profitFactor != null && stats.profitFactor > 1 ? "pos" : stats.profitFactor != null ? "neg" : undefined}
        >
          {stats.trades > 0 && (
            <Donut
              parts={[
                { value: stats.grossWin, color: COLORS.green },
                { value: stats.grossLoss, color: COLORS.red },
              ]}
            />
          )}
        </Kpi>
      ),
    },
    expectancy: {
      label: "Trade expectancy",
      size: "kpi",
      render: () => (
        <Kpi
          title={tr("Trade expectancy")}
          help={tr("Dit is je nettoresultaat gedeeld door je aantal trades: wat een gemiddelde trade opleverde.")}
          tag={tag}
          value={money2(stats.expectancy)}
          tone={stats.expectancy > 0 ? "pos" : stats.expectancy < 0 ? "neg" : undefined}
        />
      ),
    },
    avgR: {
      label: "Gemiddelde R",
      size: "kpi",
      render: () => (
        <Kpi
          title={tr("Gemiddelde R")}
          help={tr("Dit laat zien hoe een gemiddelde trade het deed tegenover het risico dat je per trade had gepland. Stel een gepland risico in bij je account en het vult zich.")}
          tag={tag}
          value={stats.avgR == null ? "—" : `${fixed(stats.avgR, 2)}R`}
        />
      ),
    },
    year: {
      label: "Jaaroverzicht",
      size: "full",
      render: () => <YearOverview stats={stats} unit={unit} onPickMonth={(y, mo) => setCalendarCursor({ y, mo })} />,
    },
    calendar: {
      label: "Maandkalender",
      size: "full",
      render: () => <PnlCalendar stats={stats} unit={unit} cursor={calendarCursor} setCursor={setCalendarCursor} onPickDay={onPickDay} />,
    },
    recent: {
      label: "Recente trades",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Recente trades")} tag={tag} />
          {recent.length === 0 ? (
            <Empty>{tr("Nog geen trades. Log je eerste trade of importeer een bestand.")}</Empty>
          ) : (
            <div className="flex flex-col">
              {recent.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTrade(t.id)}
                  className="flex items-center justify-between gap-2 py-2 text-xs text-left"
                  style={{ borderBottom: `1px solid ${COLORS.grid}` }}
                >
                  <span style={{ color: COLORS.textMuted, fontFamily: MONO }}>{t.day.slice(5)}</span>
                  <span className="flex-1 truncate font-semibold" style={{ color: COLORS.text }}>
                    {t.symbol} {t.direction} ×{t.qty}
                  </span>
                  <span className="font-bold" style={{ color: toneColor(t.v[unit]), fontFamily: MONO }}>
                    {money2(t.v[unit])}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      ),
    },
    mood: {
      label: "Emotie & resultaat",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle
            title={tr("Emotie & resultaat")}
            help={tr("Gemiddeld resultaat per trade, per emotionele toestand die je vooraf aanvinkte.")}
            tag={tag}
          />
          {moodRows.length === 0 ? <Empty>{tr("Vink bij een trade je emotionele toestand aan om hier patronen te zien.")}</Empty> : <HBars rows={moodRows} />}
        </Card>
      ),
    },
    winLine: {
      label: "Win % over tijd",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Win %")} help={tr("Je winrate over alles tot en met die dag, tegenover het percentage dat je nodig had om quitte te spelen.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={(v) => `${Math.round(v * 100)}%`}
            zero={false}
            series={[
              { name: "Win %", color: COLORS.green, values: stats.series.map((s) => s.winRate), area: true },
              { name: "Nodig", color: COLORS.textMuted, values: stats.series.map((s) => s.neededWinRate), dashed: true },
            ]}
          />
        </Card>
      ),
    },
    ratioLine: {
      label: "Gem. winst : gem. verlies",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Gem. winst : gem. verlies")} help={tr("Je winnaars tegenover je verliezers, tegenover de verhouding die je nodig had.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={(v) => fixed(v, 1)}
            zero={false}
            series={[
              { name: "Verhouding", color: COLORS.green, values: stats.series.map((s) => s.ratio), area: true },
              { name: "Nodig", color: COLORS.textMuted, values: stats.series.map((s) => s.neededRatio), dashed: true },
            ]}
          />
        </Card>
      ),
    },
    wlLine: {
      label: "Winst en verlies over tijd",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Gem. winst / gem. verlies")} help={tr("Elk punt is alles tot en met die dag. Winnaars boven de lijn, verliezers eronder.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={fmtAxis}
            series={[
              { name: "Gem. winst", color: COLORS.green, values: stats.series.map((s) => s.avgWin), area: true, pillFormat: (v) => unitValue(v, unit, { dec: 0 }) },
              { name: "Gem. verlies", color: COLORS.red, values: stats.series.map((s) => (s.avgLoss != null ? -s.avgLoss : null)), area: true, pillFormat: (v) => unitValue(v, unit, { dec: 0 }) },
            ]}
          />
        </Card>
      ),
    },
    expLine: {
      label: "Expectancy",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Expectancy")} help={tr("Wat één trade gemiddeld opleverde, over alles tot en met die dag.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={fmtAxis}
            series={[{ name: "Expectancy", color: COLORS.green, values: stats.series.map((s) => s.expectancy), area: true, pillFormat: (v) => unitValue(v, unit, { dec: 1 }) }]}
          />
        </Card>
      ),
    },
    drawdown: {
      label: "Drawdown",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Drawdown")} help={tr("Hoe ver je onder je eigen hoogste punt hebt gezeten.")} tag={tag} />
          <LineChart xs={dates} xFormat={xFmt} yFormat={fmtAxis} series={[{ name: "Drawdown", color: COLORS.red, values: stats.series.map((s) => -s.dd), area: true }]} />
          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]" style={{ color: COLORS.textMuted }}>
            <div>
              <div className="uppercase text-[9px]" style={{ fontFamily: MONO }}>{tr("Nu")}</div>
              <div style={{ color: dd.atHigh ? COLORS.green : COLORS.red }}>{dd.atHigh ? tr("Op je hoogste punt") : unitValue(-dd.current, unit)}</div>
            </div>
            <div>
              <div className="uppercase text-[9px]" style={{ fontFamily: MONO }}>{tr("Diepste")}</div>
              <div style={{ color: COLORS.text }}>{dd.max > 0 ? unitValue(-dd.max, unit) : tr("nog niets teruggegeven")}</div>
            </div>
            <div>
              <div className="uppercase text-[9px]" style={{ fontFamily: MONO }}>{tr("Langst onder")}</div>
              <div style={{ color: COLORS.text }}>{dd.longestUnder ? tr("{n} dagen", { n: dd.longestUnder }) : "—"}</div>
            </div>
          </div>
        </Card>
      ),
    },
    size: {
      label: "Positiegrootte",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Positiegrootte")} help={tr("Hoe groot één trade was, dag voor dag (gemiddeld aantal contracten).")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={(v) => fixed(v, 1)}
            zero={false}
            series={[{ name: "Contracten", color: COLORS.gold, values: stats.series.map((s) => s.avgQty), area: true, pillFormat: (v) => fixed(v, 1) }]}
            refs={stats.contractsPerTrade != null ? [{ value: stats.contractsPerTrade, color: COLORS.textMuted }] : []}
          />
        </Card>
      ),
    },
    daily: {
      label: "Netto dagresultaat",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Netto dagresultaat")} help={tr("Eén staaf per handelsdag, na kosten.")} tag={tag} />
          <BarChart
            yFormat={fmtAxis}
            items={stats.days.map((d) => ({
              key: d.date,
              label: shortDate(d.date),
              value: d.value,
              sub: tr(d.trades === 1 ? "{n} trade" : "{n} trades", { n: d.trades }),
            }))}
          />
        </Card>
      ),
    },
    hold: {
      label: "Per houdtijd",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Per houdtijd")} help={tr("Elk punt is één trade, geplaatst op hoe lang je hem vasthield (minuten).")} tag={tag} />
          <DotPlot points={stats.holdPoints.map((p) => ({ ...p, label: duration(p.x * 60000) }))} xDomain={[0, maxHold]} xTicks={holdTicks(maxHold)} yFormat={fmtAxis} />
        </Card>
      ),
    },
    timeOfDay: {
      label: "Per tijdstip",
      size: "chart",
      render: () => (
        <Card>
          <CardTitle title={tr("Per tijdstip")} help={tr("Elk punt is één trade, geplaatst op het uur waarop je hem opende.")} tag={tag} />
          <DotPlot
            points={stats.timePoints.map((p) => ({ ...p, label: `${String(Math.floor(p.x)).padStart(2, "0")}:${String(Math.round((p.x % 1) * 60)).padStart(2, "0")}` }))}
            xDomain={[hMin, hMax]}
            xTicks={Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i).filter((h) => (hMax - hMin <= 9 ? true : h % 2 === 0)).map((h) => ({ v: h, label: String(h) }))}
            yFormat={fmtAxis}
          />
        </Card>
      ),
    },
    cumulative: {
      label: "Cumulatief resultaat",
      size: "full",
      render: () => (
        <Card>
          <CardTitle title={tr("Cumulatief resultaat")} help={tr("Elke handelsdag opgeteld, op volgorde. De vorm zegt meer dan het eindpunt.")} tag={tag} />
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
            {stats.series.length
              ? tr("Elke handelsdag sinds {d} · eindigend op {v}", { d: dateOnlyLabel(stats.series[0].date), v: unitValue(stats.net, unit) })
              : tr("Nog geen handelsdagen.")}
          </p>
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={fmtAxis}
            height={220}
            series={[{ name: "Cumulatief", color: COLORS.gold, values: stats.series.map((s) => s.cum), area: true, pillFormat: (v) => unitValue(v, unit, { dec: 0 }) }]}
          />
        </Card>
      ),
    },
  };
}

// Kolommen op een raster van 2 (mobiel) / 6 (tablet) / 6 (breed): kerncijfers 1/3, grafieken 1/2 of 1/3, kalenders vol.
const SPAN = {
  kpi: "col-span-1 max-[379px]:col-span-2 md:col-span-2",
  chart: "col-span-2 md:col-span-3 xl:col-span-2",
  full: "col-span-2 md:col-span-6",
};

export function JournalView({ ctx, settings, onPickDay, onOpenTrade, calendarCursor, setCalendarCursor }) {
  const { stats, unit, balance, scoped, tz, today } = ctx;
  const tag = periodTag(settings.period);
  const dates = stats.series.map((s) => s.date);
  const moodRows = stats.byMood.map((m) => ({
    key: m.key,
    label: tr(m.key),
    sub: `n=${m.trades}`,
    value: m.expectancy ?? 0,
    text: unitValue(m.expectancy, unit, { sign: true }),
  }));
  const hours = stats.timePoints.map((p) => p.x);
  const widgets = buildWidgets({
    stats,
    unit,
    balance,
    tag,
    dates,
    xFmt: (d) => shortDate(d),
    fmtAxis: (v) => axisValue(v, unit),
    recent: [...scoped].reverse().slice(0, 6),
    moodRows,
    netTone: stats.net > 0 ? "pos" : stats.net < 0 ? "neg" : undefined,
    maxHold: Math.max(15, ...stats.holdPoints.map((p) => p.x)),
    hMin: Math.floor(Math.min(8, ...hours, 8)),
    hMax: Math.ceil(Math.max(16, ...hours, 16)),
    dd: stats.drawdown,
    onPickDay,
    onOpenTrade,
    calendarCursor,
    setCalendarCursor,
  });

  const [layouts, setLayouts] = useState(loadState);
  const [draft, setDraft] = useState(null); // null = niet aan het indelen; anders de werkvolgorde
  const arranging = draft !== null;
  const order = arranging ? draft : orderFor(layouts);
  const commit = (next) => {
    setLayouts(next);
    persistState(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <LayoutBar
        layouts={layouts}
        arranging={arranging}
        draft={draft}
        labelOf={(id) => tr(widgets[id].label)}
        onPick={(name) => commit({ ...layouts, active: name })}
        onStart={() => setDraft(orderFor(layouts))}
        onCancel={() => setDraft(null)}
        onSave={(name) => {
          commit(saveAs(layouts, name, draft));
          setDraft(null);
        }}
        onDelete={(name) => commit(removeLayout(layouts, name))}
        onAdd={(id) => setDraft(addWidget(draft, id))}
        onReset={() => setDraft([...DEFAULT_ORDER])}
      />

      {order.length === 0 && <Empty>{tr("Alle widgets zijn verborgen. Kies ‘Indelen / widget toevoegen’ om ze terug te zetten.")}</Empty>}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {order.map((id, i) => {
          const w = widgets[id];
          const inner = <div className="flex flex-1 flex-col [&>*]:flex-1">{w.render()}</div>;
          return (
            <div key={id} className={`flex flex-col ${SPAN[w.size]} ${arranging ? "rounded-xl p-1.5" : ""}`} style={arranging ? { border: `1px dashed ${COLORS.cardBorder}` } : undefined}>
              {arranging && (
                <div className="flex items-center justify-between gap-1 pb-1.5">
                  <span className="text-[10px] uppercase tracking-widest truncate" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                    {tr(w.label)}
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <IconBtn label={tr("Omhoog")} disabled={i === 0} onClick={() => setDraft(moveWidget(draft, id, -1))}>
                      <ArrowUp size={13} />
                    </IconBtn>
                    <IconBtn label={tr("Omlaag")} disabled={i === order.length - 1} onClick={() => setDraft(moveWidget(draft, id, 1))}>
                      <ArrowDown size={13} />
                    </IconBtn>
                    <IconBtn label={tr("Verbergen")} onClick={() => setDraft(hideWidget(draft, id))}>
                      <EyeOff size={13} />
                    </IconBtn>
                  </span>
                </div>
              )}
              {inner}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-center" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {tr("Tijden in {tz} · vandaag {today}", { tz, today })}
      </p>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 disabled:opacity-30"
      style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
    >
      {children}
    </button>
  );
}

// Datum -> {y, mo} voor de kalendercursor.
export function cursorFor(date) {
  const { y, mo } = parseDate(date);
  return { y, mo };
}

