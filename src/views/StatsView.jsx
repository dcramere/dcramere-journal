import { Rich } from "../ui/Rich.jsx";
import React, { useMemo, useState } from "react";
import { COLORS, MONO, toneColor } from "../theme.js";
import {
  axisValue,
  dateOnlyLabel,
  weekdayShort2,
  duration,
  fixed,
  money,
  pct,
  shortDate,
  unitValue,
} from "../lib/format.js";
import {
  MIN_TRADES_SIMULATION,
  daysToTarget,
  growthStats,
  kelly,
  monteCarlo,
  projectBalance,
  riskOfRuin,
} from "../lib/metrics.js";
import { BarChart, LineChart, YearGrid } from "../ui/charts.jsx";
import { Card, CardTitle, Empty, Segmented, Select } from "../ui/primitives.jsx";
import { periodTag } from "./JournalView.jsx";
import { tr } from "../i18n.js";

function StatRow({ label, value, sub, color }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-xs" style={{ borderBottom: `1px solid ${COLORS.grid}` }}>
      <span style={{ color: COLORS.textMuted }}>
        {label}
        {sub && <span className="block text-[10px] opacity-70">{sub}</span>}
      </span>
      <span className="font-semibold text-right" style={{ color: color || COLORS.text, fontFamily: MONO }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: COLORS.gold, fontFamily: MONO }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const GROUP_METRICS = [
  { value: "win", label: "Win %" },
  { value: "net", label: "Netto" },
  { value: "avgWin", label: "Gem. winst" },
  { value: "avgLoss", label: "Gem. verlies" },
  { value: "hold", label: "Gem. duur" },
  { value: "summary", label: "Overzicht" },
];

function GroupCard({ title, help, tag, rows, unit, labelOf, emptyText }) {
  const [metric, setMetric] = useState("net");
  const value = (r) => {
    switch (metric) {
      case "win":
        return r.winRate ?? 0;
      case "avgWin":
        return r.avgWin ?? 0;
      case "avgLoss":
        return r.avgLoss != null ? -r.avgLoss : 0;
      case "hold":
        return r.avgHold ?? 0;
      default:
        return r.net;
    }
  };
  const fmt = (v) => (metric === "win" ? `${Math.round(v * 100)}%` : metric === "hold" ? duration(v) : axisValue(v, unit));
  return (
    <Card>
      <CardTitle title={title} help={help} tag={tag} />
      <div className="mb-2 overflow-x-auto">
        <Segmented size="sm" options={GROUP_METRICS} value={metric} onChange={setMetric} ariaLabel={`${title}: ${tr("metriek")}`} />
      </div>
      {!rows.length ? (
        <Empty>{emptyText || "Nog geen data"}</Empty>
      ) : metric === "summary" ? (
        <table className="w-full text-xs" style={{ fontFamily: MONO }}>
          <thead>
            <tr style={{ color: COLORS.textMuted }}>
              <th className="text-left font-normal py-1">&nbsp;</th>
              <th className="text-right font-normal">{tr("Trades")}</th>
              <th className="text-right font-normal">{tr("Win %")}</th>
              <th className="text-right font-normal">{tr("Netto")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderTop: `1px solid ${COLORS.grid}` }}>
                <td className="py-1.5" style={{ color: COLORS.text }}>
                  {labelOf(r.key)}
                </td>
                <td className="text-right">{r.trades}</td>
                <td className="text-right">{pct(r.winRate)}</td>
                <td className="text-right font-semibold" style={{ color: toneColor(r.net) }}>
                  {unitValue(r.net, unit, { sign: true, dec: unit === "$" ? 0 : 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <BarChart
          yFormat={fmt}
          items={rows.map((r) => ({
            key: r.key,
            label: labelOf(r.key),
            value: value(r),
            sub: tr(r.trades === 1 ? "{n} trade" : "{n} trades", { n: r.trades }),
          }))}
        />
      )}
    </Card>
  );
}

function FanChart({ mc }) {
  const xs = mc.actualPath.map((_, i) => String(i));
  const band = (q) => mc.bands.find((b) => b.q === q).values; return (
    <>
      <LineChart
        xs={xs}
        xFormat={(x) => `#${x}`}
        yFormat={(v) => axisValue(v, "$")}
        height={210}
        series={[
          { name: "95e perc.", color: "rgba(212,175,55,0.35)", values: band(0.95), pill: false },
          { name: "75e perc.", color: "rgba(212,175,55,0.55)", values: band(0.75), pill: false },
          { name: "Mediaan", color: COLORS.textMuted, values: band(0.5), dashed: true, pill: false },
          { name: "25e perc.", color: "rgba(212,175,55,0.55)", values: band(0.25), pill: false },
          { name: "5e perc.", color: "rgba(212,175,55,0.35)", values: band(0.05), pill: false },
          { name: "Jouw volgorde", color: COLORS.gold, values: mc.actualPath, area: true, pillFormat: (v) => money(v, { dec: 0 }) },
        ]}
      />
      <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
        <Rich
          k="Je {n} trades in {s} willekeurige volgordes: het eindresultaat blijft gelijk, maar de weg erheen niet. Jouw grootste terugval (trade voor trade) was <b>{a}</b>; in de helft van de herschikkingen ligt die rond <b>{b}</b>, in 1 op 20 boven <b>{c}</b>."
          p={{ n: mc.n, s: mc.sims, a: money(mc.actualDd, { dec: 0 }), b: money(mc.ddP50, { dec: 0 }), c: money(mc.ddP95, { dec: 0 }) }}
        />
      </p>
    </>
  );
}

export function StatsView({ ctx, settings }) {
  const { stats, unit, balance, scoped, accountTrades, scopedAccounts, today } = ctx;
  const tag = periodTag(settings.period);
  const fmtAxis = (v) => axisValue(v, unit);
  const dates = stats.series.map((s) => s.date);

  const latestYear = stats.days.length ? Number(stats.days[stats.days.length - 1].date.slice(0, 4)) : Number(today.slice(0, 4));
  const [year, setYear] = useState(latestYear);
  const yearDays = stats.days.filter((d) => d.date.startsWith(String(year)));
  const green = yearDays.filter((d) => d.value > 0).length;
  const red = yearDays.filter((d) => d.value < 0).length;

  const [targetMode, setTargetMode] = useState("amount");
  const [targetText, setTargetText] = useState("1000000");
  const [horizon, setHorizon] = useState("1");
  const [ruinPct, setRuinPct] = useState("10");

  const growth = useMemo(() => growthStats(accountTrades, scopedAccounts, today), [accountTrades, scopedAccounts, today]);
  const target = targetMode === "double" && growth ? growth.base * 2 : Number(targetText.replace(/[^0-9.]/g, "")) || 0;
  const days = growth ? daysToTarget(growth, target) : null;
  const projection = growth ? projectBalance(growth, Number(horizon)) : null;

  const dollars = useMemo(() => scoped.map((t) => t.v.$), [scoped]);
  const mc = useMemo(() => monteCarlo(dollars), [dollars]);
  const startBal = scopedAccounts.reduce((s, a) => s + (Number(a.startBalance) || 0), 0);
  const ruin = useMemo(() => riskOfRuin(dollars, (startBal * Number(ruinPct)) / 100), [dollars, startBal, ruinPct]); const k = kelly(stats.winRate, stats.ratio); const firstAccount = scopedAccounts[0]; const plannedRisk = firstAccount ? firstAccount.riskUnit === "$" ? (Number(firstAccount.riskValue) || 0) / (Number(firstAccount.startBalance) || 1) : (Number(firstAccount.riskValue) || 0) / 100 : null; const s = stats; const dd = s.drawdown; return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle title={tr("{year} in één oogopslag", { year })} help={tr("Elke dag van het jaar: groen = winst, rood = verlies, hoe donkerder hoe groter.")} />
          <div className="flex gap-2 text-xs" style={{ color: COLORS.textMuted }}>
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label={tr("Vorig jaar")}>‹</button>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label={tr("Volgend jaar")}>›</button>
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
          {tr("{g} groene dagen, {r} rode, over de getoonde dagen.", { g: green, r: red })}
        </p>
        <YearGrid year={year} days={yearDays} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardTitle title={tr("Cumulatief resultaat")} help={tr("Elke handelsdag opgeteld. De vorm zegt meer dan het eindpunt.")} tag={tag} />
          <LineChart
            xs={dates}
            xFormat={shortDate}
            yFormat={fmtAxis}
            series={[{ name: "Cumulatief", color: COLORS.gold, values: s.series.map((x) => x.cum), area: true, pillFormat: (v) => unitValue(v, unit, { dec: 0 }) }]}
          />
        </Card>
        <Card>
          <CardTitle title={tr("Accountsaldo")} help={tr("Altijd in dollars. Goud: stortingen of opnames.")} tag={tr("ALLE TIJD")} />
          <LineChart
            xs={balance.points.map((p) => p.date)}
            xFormat={shortDate}
            yFormat={(v) => axisValue(v, "$")}
            zero={false}
            series={[{ name: "Saldo", color: COLORS.gold, values: balance.points.map((p) => p.balance), area: true, pillFormat: (v) => money(v, { dec: 0 }) }]}
          />
          {balance.points.some((p) => p.hasAdjustment) && (
            <p className="text-[11px] mt-1" style={{ color: COLORS.gold }}>
              {tr("Stortingen/opnames op:")} {balance.points.filter((p) => p.hasAdjustment).map((p) => `${shortDate(p.date)} (${money(p.flow, { sign: true, dec: 0 })})`).join(", ")}
            </p>
          )}
        </Card>
        <Card>
          <CardTitle title={tr("Drawdown")} help={tr("Hoe ver je onder je eigen hoogste punt hebt gezeten.")} tag={tag} />
          <LineChart xs={dates} xFormat={shortDate} yFormat={fmtAxis} series={[{ name: "Drawdown", color: COLORS.red, values: s.series.map((x) => -x.dd), area: true }]} />
          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]" style={{ color: COLORS.textMuted }}>
            <div>
              <div className="uppercase text-[9px]" style={{ fontFamily: MONO }}>{tr("Nu")}</div>
              <div style={{ color: dd.atHigh ? COLORS.green : COLORS.red }}>{dd.atHigh ? tr("Op je hoogste punt") : unitValue(-dd.current, unit)}</div>
            </div>
            <div>
              <div className="uppercase text-[9px]" style={{ fontFamily: MONO }}>{tr("Diepste")}</div>
              <div style={{ color: COLORS.text }}>{dd.max > 0 ? `${unitValue(-dd.max, unit)}${dd.maxDate ? ` · ${shortDate(dd.maxDate)}` : ""}` : "—"}</div>
            </div>
            <div>
              <div className="uppercase text-[9px]" style={{ fontFamily: MONO }}>{tr("Langst onder")}</div>
              <div style={{ color: COLORS.text }}>{dd.longestUnder ? tr("{n} dagen", { n: dd.longestUnder }) : "—"}</div>
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle title={tr("Reeksen")} help={tr("Hoe lang je series winst en verlies waren.")} tag={tag} />
          {s.streaks.histogram.length === 0 ? (
            <Empty>{tr("Nog geen reeksen")}</Empty>
          ) : (
            <>
              <div className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
                <Rich k="Langste reeks: <green>{w} winst</green> · <red>{l} verlies</red>" p={{ w: s.streaks.longestWin, l: s.streaks.longestLoss }} />
                {s.streaks.current.type !== 0 && (
                  <>
                    {" "}· <Rich
                      k={s.streaks.current.type > 0 ? "Nu: <green>{n} gewonnen op rij</green>" : "Nu: <red>{n} verloren op rij</red>"}
                      p={{ n: s.streaks.current.len }}
                    />
                  </>
                )}
              </div>
              <table className="w-full text-xs" style={{ fontFamily: MONO }}>
                <thead>
                  <tr style={{ color: COLORS.textMuted }}>
                    <th className="text-left font-normal">{tr("Op rij")}</th>
                    <th className="text-right font-normal">{tr("Winst")}</th>
                    <th className="text-right font-normal">{tr("Verlies")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.streaks.histogram.map((h) => (
                    <tr key={h.len} style={{ borderTop: `1px solid ${COLORS.grid}` }}>
                      <td className="py-1">{h.len}</td>
                      <td className="text-right" style={{ color: h.won ? COLORS.green : COLORS.textMuted }}>{h.won || "—"}</td>
                      <td className="text-right" style={{ color: h.lost ? COLORS.red : COLORS.textMuted }}>{h.lost || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle title={tr("Jouw statistieken")} help={tr("Alles in één overzicht, in de gekozen eenheid.")} tag={tag} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">
          <Section title={tr("Het resultaat")}>
            <StatRow label={tr("Totaal resultaat")} value={unitValue(s.net, unit, { sign: true })} color={toneColor(s.net)} />
            <StatRow label={tr("Trade expectancy")} value={unitValue(s.expectancy, unit, { sign: true })} />
            <StatRow label={tr("Profit factor")} value={s.profitFactor == null ? "—" : fixed(s.profitFactor, 2)} />
            <StatRow label={tr("Win rate")} value={pct(s.winRate)} sub={tr("gewonnen {w} · verloren {l}", { w: s.wins, l: s.losses })} />
            <StatRow label={tr("Gemiddelde R")} value={s.avgR == null ? "—" : `${fixed(s.avgR, 2)}R`} />
            <StatRow label={tr("Totaal trades")} value={s.trades} />
            <StatRow label={tr("Winst · BE · verlies")} value={`${s.wins} · ${s.be} · ${s.losses}`} />
          </Section>
          <Section title={tr("Dagen")}>
            <StatRow label={tr("Handelsdagen")} value={s.tradingDays} />
            <StatRow label={tr("Winst · BE · verlies")} value={`${s.winDays} · ${s.beDays} · ${s.lossDays}`} />
            <StatRow label={tr("Dagen met notitie")} value={tr("{a} van {b}", { a: s.notedDays, b: s.tradingDays })} />
            <StatRow label={tr("Gemiddelde dag")} value={unitValue(s.avgDay, unit, { sign: true })} />
            <StatRow label={tr("Gem. winnende dag")} value={unitValue(s.avgWinDay, unit, { sign: true })} />
            <StatRow label={tr("Gem. verliesdag")} value={unitValue(s.avgLossDay, unit)} />
            <StatRow label={tr("Beste dag")} value={s.bestDay ? unitValue(s.bestDay.value, unit, { sign: true }) : "—"} sub={s.bestDay ? shortDate(s.bestDay.date) : undefined} />
            <StatRow label={tr("Slechtste dag")} value={s.worstDay ? unitValue(s.worstDay.value, unit, { sign: true }) : "—"} sub={s.worstDay ? shortDate(s.worstDay.date) : undefined} />
          </Section>
          <Section title={tr("De trades zelf")}>
            <StatRow label={tr("Gem. winnende trade")} value={unitValue(s.avgWin, unit, { sign: true })} />
            <StatRow label={tr("Gem. verliezende trade")} value={unitValue(s.avgLoss != null ? -s.avgLoss : null, unit)} />
            <StatRow label={tr("Gemiddelde trade")} value={unitValue(s.expectancy, unit, { sign: true })} />
            <StatRow label={tr("Grootste winst")} value={unitValue(s.largestWin, unit, { sign: true })} />
            <StatRow label={tr("Grootste verlies")} value={unitValue(s.largestLoss, unit)} />
            <StatRow label={tr("Gem. duur")} value={duration(s.avgHold)} />
            <StatRow label={tr("Gem. duur winnaars")} value={duration(s.avgHoldWin)} />
            <StatRow label={tr("Gem. duur verliezers")} value={duration(s.avgHoldLoss)} />
            <StatRow label={tr("Langste trade")} value={duration(s.longestHold)} />
            <StatRow label={tr("Contracten verhandeld")} value={s.contracts} />
            <StatRow label={tr("Trades per dag")} value={fixed(s.tradesPerDay, 1)} />
            <StatRow label={tr("Contracten per trade")} value={fixed(s.contractsPerTrade, 1)} />
          </Section>
          <Section title={tr("Maanden")}>
            <StatRow label={tr("Beste maand")} value={s.bestMonth ? unitValue(s.bestMonth.net, unit, { sign: true }) : "—"} sub={s.bestMonth ? s.bestMonth.month : undefined} />
            <StatRow label={tr("Slechtste maand")} value={s.worstMonth ? unitValue(s.worstMonth.net, unit, { sign: true }) : "—"} sub={s.worstMonth ? s.worstMonth.month : undefined} />
            <StatRow label={tr("Gemiddeld per maand")} value={unitValue(s.avgMonth, unit, { sign: true })} />
          </Section>
          <Section title={tr("Reeksen & drawdown")}>
            <StatRow label={tr("Langste winstreeks")} value={tr("{n} trades", { n: s.streaks.longestWin })} />
            <StatRow label={tr("Langste verliesreeks")} value={tr("{n} trades", { n: s.streaks.longestLoss })} />
            <StatRow label={tr("Winstdagen op rij")} value={tr("{n} dagen", { n: s.streaks.winDaysRow })} />
            <StatRow label={tr("Verliesdagen op rij")} value={tr("{n} dagen", { n: s.streaks.lossDaysRow })} />
            <StatRow label={tr("Max drawdown")} value={unitValue(-dd.max, unit)} sub={dd.maxPct != null ? `${fixed(dd.maxPct * 100, 2)}%` : undefined} />
            <StatRow label={tr("Gem. drawdown")} value={unitValue(-dd.avg, unit)} />
          </Section>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GroupCard title={tr("Per weekdag")} help={tr("Hoe elke weekdag je behandelt.")} tag={tag} rows={s.byWeekday} unit={unit} labelOf={(k) => weekdayShort2(k)} />
        <GroupCard title={tr("Per uur")} help={tr("Hoe elk deel van de sessie je behandelt (uur waarop je opende).")} tag={tag} rows={s.byHour} unit={unit} labelOf={(k) => `${k}:00`} />
        <GroupCard title={tr("Per contract")} help={tr("Netto resultaat per markt.")} tag={tag} rows={s.byContract} unit={unit} labelOf={(k) => tr(k)} />
        <GroupCard title={tr("Long of short?")} help={tr("Of één richting stilletjes de andere draagt.")} tag={tag} rows={s.bySide} unit={unit} labelOf={(k) => tr(k)} />
        <GroupCard title={tr("Per emotionele toestand")} help={tr("Hoe je trades uitpakken per stemming die je vooraf aanvinkte.")} tag={tag} rows={s.byMood} unit={unit} labelOf={(k) => tr(k)} emptyText={tr("Vink bij je trades een emotie aan om dit te zien.")} />
        <GroupCard title={tr("Per setup")} help={tr("Welke setups werken.")} tag={tag} rows={s.bySetup} unit={unit} labelOf={(k) => tr(k)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardTitle title={tr("Tijd tot doel")} help={tr("Wanneer het tempo van je eigen record een dollardoel zou bereiken (samengestelde groei per marktdag).")} tag={tr("ALLE TIJD")} />
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Segmented size="sm" value={targetMode} onChange={setTargetMode} options={[{ value: "amount", label: "Bedrag" }, { value: "double", label: "Verdubbel account" }]} ariaLabel={tr("Doeltype")} />
            {targetMode === "amount" && (
              <label className="flex items-center gap-1 text-xs" style={{ color: COLORS.textMuted }}>
                {tr("Doel $")}
                <input
                  inputMode="numeric"
                  value={targetText}
                  onChange={(e) => setTargetText(e.target.value)}
                  className="rounded px-2 py-1 w-28 text-xs"
                  style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
                />
              </label>
            )}
          </div>
          {!growth || growth.perDay == null ? (
            <Empty>{tr("Er zijn minstens twee handelsdagen nodig om een tempo te berekenen.")}</Empty>
          ) : growth.perDay <= 0 ? (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              <Rich k="Je record groeit nog niet (<red>{v}% per marktdag</red>), dus er is geen datum te berekenen." p={{ v: fixed(growth.perDay * 100, 3) }} />
            </p>
          ) : (
            <>
              <p className="text-sm" style={{ color: COLORS.text }}>
                <Rich
                  k="Met het tempo van je record komt je {a} op {b} over ongeveer <g>{d} marktdagen</g> ({y} jaar)."
                  p={{ a: money(growth.balance, { dec: 0 }), b: money(target, { dec: 0 }), d: Math.round(days), y: fixed(days / 252, 1) }}
                />
              </p>
              <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                {tr("Je tempo: {r}% per marktdag, over {n} marktdagen sinds {d}.", { r: fixed(growth.perDay * 100, 3, { sign: true }), n: growth.days, d: dateOnlyLabel(growth.firstDay) })}
              </p>
            </>
          )}
        </Card>

        <Card>
          <CardTitle title={tr("Effectieve groeisnelheid")} help={tr("Het samengestelde tempo van je record per marktdag, doorgetrokken.")} tag={tr("ALLE TIJD")} />
          <div className="mb-3">
            <Segmented size="sm" value={horizon} onChange={setHorizon} options={[{ value: "1", label: "1 jaar" }, { value: "2", label: "2 jaar" }, { value: "5", label: "5 jaar" }]} ariaLabel={tr("Horizon")} />
          </div>
          {projection == null ? (
            <Empty>{tr("Er zijn minstens twee handelsdagen nodig om een tempo te berekenen.")}</Empty>
          ) : (
            <>
              <p className="text-sm" style={{ color: COLORS.text }}>
                <Rich
                  k="Met het tempo van je record wordt je {a} van nu <g>{b}</g> over {h} jaar — ×{x}."
                  p={{ a: money(growth.balance, { dec: 0 }), b: money(projection, { dec: 0 }), h: horizon, x: fixed(projection / growth.balance, 2) }}
                />
              </p>
              <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                {tr("Een hypothese op basis van {n} marktdagen, geen voorspelling. Korte reeksen zijn weinig betrouwbaar.", { n: growth.days })}
              </p>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle title={tr("Monte Carlo")} help={tr("Waar handelen zoals dit toe leidt, en hoeveel daarvan volgorde-geluk is.")} tag={tag} />
          {mc ? (
            <FanChart mc={mc} />
          ) : (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {tr("Nog te weinig trades — {a} van {b}. Een beeld op een dunne steekproef lijkt zeker maar is dat niet, dus deze kaart wacht.", { a: scoped.length, b: MIN_TRADES_SIMULATION })}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle title={tr("Kans op ruïne")} help={tr("De kans dat een reeks van 100 trades (getrokken uit je eigen resultaten) je een bepaald deel van je startsaldo kost.")} tag={tag} />
          {ruin ? (
            <>
              <div className="mb-2">
                <Select
                  label={tr("Verlies van")}
                  value={ruinPct}
                  onChange={setRuinPct}
                  options={["5", "10", "20", "50"].map((p) => ({ value: p, label: tr("{p}% van startsaldo", { p }), raw: true }))}
                />
              </div>
              <p className="text-sm" style={{ color: COLORS.text }}>
                <Rich
                  k={ruin.probability > 0.1 ? "<red>{p}</red> kans dat je binnen {h} trades {m} verliest ({s} simulaties)." : "<green>{p}</green> kans dat je binnen {h} trades {m} verliest ({s} simulaties)."}
                  p={{ p: pct(ruin.probability, 1), h: ruin.horizon, m: money((startBal * Number(ruinPct)) / 100, { dec: 0 }), s: ruin.sims }}
                />
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {tr("Nog te weinig trades — {a} van {b}. Een beeld op een dunne steekproef lijkt zeker maar is dat niet, dus deze kaart wacht.", { a: scoped.length, b: MIN_TRADES_SIMULATION })}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle title={tr("Kelly-criterium")} help={tr("Het risico per trade dat je winrate en uitbetaling zouden kunnen dragen, naast wat je plant.")} tag={tag} />
          {k == null ? (
            <Empty>{tr("Er zijn winnende én verliezende trades nodig.")}</Empty>
          ) : (
            <div className="text-xs">
              <StatRow label={tr("Kelly (volledig)")} value={`${fixed(k * 100, 1)}%`} sub={tr("van je account per trade")} />
              <StatRow label={tr("Half Kelly")} value={`${fixed((k * 100) / 2, 1)}%`} />
              <StatRow label={tr("Jouw geplande risico")} value={plannedRisk == null ? "—" : `${fixed(plannedRisk * 100, 2)}%`} />
              <p className="mt-2" style={{ color: COLORS.textMuted }}>
                {k <= 0
                  ? tr("Op basis van dit record is de verwachte waarde per trade niet positief; Kelly adviseert dan geen risico te nemen.")
                  : plannedRisk != null && plannedRisk > k
                  ? tr("Je geplande risico ligt boven volledig Kelly voor dit record.")
                  : plannedRisk != null && plannedRisk > k / 2
                  ? tr("Je geplande risico ligt tussen half en volledig Kelly.")
                  : tr("Je geplande risico ligt onder half Kelly.")}{" "}
                {tr("Kelly op een korte reeks is een ruwe richtlijn, geen advies.")}
              </p>
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
