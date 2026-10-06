import React from "react";
import { COLORS, MONO, PERIODS, toneColor } from "../theme.js";
import { PnlCalendar, YearOverview } from "../components/PnlCalendar.jsx";
import { axisValue, dateOnlyLabel, duration, fixed, money, pct, shortDate, unitValue } from "../lib/format.js";
import { parseDate } from "../lib/tz.js";
import { BarChart, DotPlot, Donut, HBars, LineChart } from "../ui/charts.jsx";
import { Card, CardTitle, Empty } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";

export function periodTag(period) {
  return tr(PERIODS.find((p) => p.value === period)?.label || "").toUpperCase();
}

function Kpi({ title, help, tag, value, tone, sub, children }) {
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

export function JournalView({ ctx, settings, onPickDay, onOpenTrade, calendarCursor, setCalendarCursor }) {
  const { stats, unit, balance, scoped, tz, today } = ctx;
  const tag = periodTag(settings.period);
  const fmtAxis = (v) => axisValue(v, unit);
  const dates = stats.series.map((s) => s.date);
  const xFmt = (d) => shortDate(d);
  const recent = [...scoped].reverse().slice(0, 6);
  const moodRows = stats.byMood.map((m) => ({
    key: m.key,
    label: tr(m.key),
    sub: `n=${m.trades}`,
    value: m.expectancy ?? 0,
    text: unitValue(m.expectancy, unit, { sign: true }),
  }));
  const netTone = stats.net > 0 ? "pos" : stats.net < 0 ? "neg" : undefined;
  const maxHold = Math.max(15, ...stats.holdPoints.map((p) => p.x));
  const hours = stats.timePoints.map((p) => p.x); const hMin = Math.floor(Math.min(8, ...hours, 8)); const hMax = Math.ceil(Math.max(16, ...hours, 16)); const dd = stats.drawdown; return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi
          title={tr("Saldo & P&L")}
          help={tr("Je totale resultaat in de gekozen periode en het huidige saldo van je account(s).")}
          tag={tag}
          value={unitValue(stats.net, unit, { sign: true })}
          tone={netTone}
          sub={tr("Saldo {v}", { v: money(balance.end) })}
        />
        <Kpi
          title={tr("Win %")}
          help={tr("Aandeel winnende trades van alle trades.")}
          tag={tag}
          value={pct(stats.winRate)}
          tone={stats.winRate != null && stats.winRate >= (stats.neededWinRate ?? 0.5) ? "pos" : undefined}
          sub={stats.neededWinRate != null ? tr("Nodig: {v}", { v: pct(stats.neededWinRate) }) : undefined}
        />
        <Kpi
          title={tr("Gem. winst / gem. verlies")}
          help={tr("Gemiddelde winnende trade gedeeld door de gemiddelde verliezende trade.")}
          tag={tag}
          value={fixed(stats.ratio, 2)}
          tone={stats.ratio != null && stats.ratio >= 1 ? "pos" : undefined}
          sub={
            stats.avgWin != null || stats.avgLoss != null
              ? `${unitValue(stats.avgWin, unit, { sign: true })} / ${unitValue(stats.avgLoss != null ? -stats.avgLoss : null, unit)}`
              : undefined
          }
        />
        <Kpi
          title={tr("Profit factor")}
          help={tr("Bruto winst gedeeld door bruto verlies. Boven 1 verdien je geld.")}
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
        <Kpi
          title={tr("Trade expectancy")}
          help={tr("Wat één trade gemiddeld oplevert.")}
          tag={tag}
          value={unitValue(stats.expectancy, unit, { sign: true })}
          tone={stats.expectancy > 0 ? "pos" : stats.expectancy < 0 ? "neg" : undefined}
        />
        <Kpi title={tr("Gemiddelde R")} help={tr("Gemiddeld resultaat in R (op basis van je geplande risico per trade).")} tag={tag} value={stats.avgR == null ? "—" : `${fixed(stats.avgR, 2)}R`} />
      </div>

      {stats.trades > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 -mt-1">
          <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
            <Chip color={COLORS.green}>{tr("{n} winst", { n: stats.wins })}</Chip>
            <Chip>{stats.be} BE</Chip>
            <Chip color={COLORS.red}>{tr("{n} verlies", { n: stats.losses })}</Chip>
          </div>
          <div className="sm:col-span-2">
            <SplitBar left={stats.wins} right={stats.losses} leftColor={COLORS.green} rightColor={COLORS.red} />
          </div>
        </div>
      )}

      <YearOverview stats={stats} unit={unit} onPickMonth={(y, mo) => setCalendarCursor({ y, mo })} />
      <PnlCalendar stats={stats} unit={unit} cursor={calendarCursor} setCursor={setCalendarCursor} onPickDay={onPickDay} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                    {unitValue(t.v[unit], unit, { sign: true })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle
            title={tr("Emotie & resultaat")}
            help={tr("Gemiddeld resultaat per trade, per emotionele toestand die je vooraf aanvinkte.")}
            tag={tag}
          />
          {moodRows.length === 0 ? (
            <Empty>{tr("Vink bij een trade je emotionele toestand aan om hier patronen te zien.")}</Empty>
          ) : (
            <HBars rows={moodRows} />
          )}
        </Card>

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

        <Card>
          <CardTitle title={tr("Expectancy")} help={tr("Wat één trade gemiddeld opleverde, over alles tot en met die dag.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={fmtAxis}
            series={[{ name: "Expectancy", color: COLORS.green, values: stats.series.map((s) => s.expectancy), area: true, pillFormat: (v) => unitValue(v, unit, { dec: 1 }) }]}
          />
        </Card>

        <Card>
          <CardTitle title={tr("Drawdown")} help={tr("Hoe ver je onder je eigen hoogste punt hebt gezeten.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={xFmt}
            yFormat={fmtAxis}
            series={[{ name: "Drawdown", color: COLORS.red, values: stats.series.map((s) => -s.dd), area: true }]}
          />
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

        <Card>
          <CardTitle title={tr("Per houdtijd")} help={tr("Elk punt is één trade, geplaatst op hoe lang je hem vasthield (minuten).")} tag={tag} />
          <DotPlot
            points={stats.holdPoints.map((p) => ({ ...p, label: duration(p.x * 60000) }))}
            xDomain={[0, maxHold]}
            xTicks={holdTicks(maxHold)}
            yFormat={fmtAxis}
          />
        </Card>

        <Card>
          <CardTitle title={tr("Per tijdstip")} help={tr("Elk punt is één trade, geplaatst op het uur waarop je hem opende.")} tag={tag} />
          <DotPlot
            points={stats.timePoints.map((p) => ({ ...p, label: `${String(Math.floor(p.x)).padStart(2, "0")}:${String(Math.round((p.x % 1) * 60)).padStart(2, "0")}` }))}
            xDomain={[hMin, hMax]}
            xTicks={Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i).filter((h) => (hMax - hMin <= 9 ? true : h % 2 === 0)).map((h) => ({ v: h, label: String(h) }))}
            yFormat={fmtAxis}
          />
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
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
      </div>
      <p className="text-[10px] text-center" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {tr("Tijden in {tz} · vandaag {today}", { tz, today })}
      </p>
    </div>
  );
}

// Datum -> {y, mo} voor de kalendercursor.
export function cursorFor(date) {
  const { y, mo } = parseDate(date);
  return { y, mo };
}

