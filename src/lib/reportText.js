// De zinnen van het rapport, in het Nederlands en Engels. De rekenkern (report.js) levert alleen
// codes en getallen; hier worden daar leesbare zinnen van gemaakt.
import { tr } from "../i18n.js";
import { fixed, money, monthLong, pct, shortDate, weekdayLong } from "./format.js";
import { parseDate } from "./tz.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const usd = (v) => money(v, { sign: true, dec: 0 });
const rr = (v) => `${fixed(v, 2, { sign: true })}R`;

export function periodLabel(kind, key, start, end) {
  if (kind === "week") return tr("Week {n} · {a} – {b}", { n: Number(key.split("-W")[1]), a: shortDate(start), b: shortDate(end) });
  const { y, mo } = parseDate(start);
  return `${cap(monthLong(mo - 1))} ${y}`;
}

export const previousLabel = (kind) => (kind === "week" ? tr("vorige week") : tr("vorige maand"));
const periodWord = (kind) => (kind === "week" ? tr("de week") : tr("de maand"));

// Eén zin per inzicht.
export function insightText(i, kind) {
  const p = i.p || {};
  const period = periodWord(kind);
  switch (i.id) {
    case "net_positive":
      return tr("Je sloot {period} positief af: {usd} ({r}).", { period, usd: usd(p.usd), r: rr(p.r) });
    case "net_negative":
      return tr("Je sloot {period} negatief af: {usd} ({r}).", { period, usd: usd(p.usd), r: rr(p.r) });
    case "net_flat":
      return tr("Je sloot {period} op break-even af.", { period });
    case "winrate_above_needed":
      return tr("Je win % ({wr}) ligt boven wat je nodig hebt om break-even te draaien ({need}).", { wr: pct(p.winRate), need: pct(p.needed) });
    case "winrate_below_needed":
      return tr("Je win % ({wr}) ligt onder wat je nodig hebt om break-even te draaien ({need}). Wacht op betere setups of laat je winnaars verder lopen.", {
        wr: pct(p.winRate),
        need: pct(p.needed),
      });
    case "payoff_good":
      return tr("Je winnaars zijn groter dan je verliezers (verhouding {ratio}). Dat geeft ruimte om af en toe fout te zitten.", { ratio: fixed(p.ratio, 2) });
    case "payoff_poor":
      return tr("Je verliezers zijn groter dan je winnaars (verhouding {ratio}). Knip verliezers sneller af of laat winnaars langer lopen.", { ratio: fixed(p.ratio, 2) });
    case "best_mood":
      return tr("Je beste trades kwamen uit de stemming ‘{mood}’: gemiddeld {avgR} over {n} trades.", { mood: tr(p.mood), avgR: rr(p.avgR), n: p.n });
    case "worst_mood":
      return tr("Trades vanuit ‘{mood}’ kostten gemiddeld {avgR} over {n} trades (samen {usd}). Neem in die stemming liever geen trade.", {
        mood: tr(p.mood),
        avgR: rr(p.avgR),
        n: p.n,
        usd: usd(p.usd),
      });
    case "best_setup":
      return tr("De setup ‘{setup}’ werkt: gemiddeld {avgR} over {n} trades (win % {wr}).", { setup: tr(p.setup), avgR: rr(p.avgR), n: p.n, wr: pct(p.winRate) });
    case "worst_setup":
      return tr("De setup ‘{setup}’ kostte gemiddeld {avgR} over {n} trades (win % {wr}). Pas hem aan of laat hem even liggen.", {
        setup: tr(p.setup),
        avgR: rr(p.avgR),
        n: p.n,
        wr: pct(p.winRate),
      });
    case "best_weekday":
      return tr("{day} is je sterkste dag: gemiddeld {avgR} over {n} trades.", { day: cap(weekdayLong(p.dow)), avgR: rr(p.avgR), n: p.n });
    case "worst_weekday":
      return tr("{day} is je zwakste dag: gemiddeld {avgR} over {n} trades.", { day: cap(weekdayLong(p.dow)), avgR: rr(p.avgR), n: p.n });
    case "best_hour":
      return tr("Rond {hour}:00 presteer je het best: gemiddeld {avgR} over {n} trades.", { hour: p.hour, avgR: rr(p.avgR), n: p.n });
    case "worst_hour":
      return tr("Rond {hour}:00 verlies je: gemiddeld {avgR} over {n} trades.", { hour: p.hour, avgR: rr(p.avgR), n: p.n });
    case "outlier_loss":
      return tr("Eén verlies ({usd}) was {x}× je gemiddelde andere verlies. Controleer of je stop goed stond en of je hem volgde.", {
        usd: usd(p.usd),
        x: fixed(p.multiple, 1),
      });
    case "size_inconsistent":
      return tr("Je positiegrootte schommelt sterk ({min} tot {max} contracten). Houd het risico per trade gelijk.", { min: p.min, max: p.max });
    case "size_up_after_loss":
      return tr("Na een verlies nam je {n}× een grotere positie; die trades leverden samen {r} op. Dat is een klassiek tilt-patroon.", { n: p.n, r: rr(p.r) });
    case "overtrading":
      return tr("Op drukke dagen (vanaf {n} trades) verlies je gemiddeld {busy} per dag; op rustige dagen {calm}. Meer trades leveren je niet meer op.", {
        n: p.n,
        busy: usd(p.busyUsd),
        calm: usd(p.calmUsd),
      });
    case "loss_streak":
      return tr("Je had een verliesreeks van {n} trades. Overweeg een vaste stopregel, bijvoorbeeld pauzeren na 3 verliezen.", { n: p.n });
    case "win_streak":
      return tr("Je langste winstreeks was {n} trades op rij.", { n: p.n });
    case "drawdown_deep":
      return tr("Je grootste terugval was {usd}. Dat is veel in verhouding tot je gemiddelde verlies.", { usd: money(p.usd, { dec: 0 }) });
    case "no_drawdown":
      return tr("Je zat geen enkele dag onder je hoogste punt.");
    case "consistent_days":
      return tr("{green} van je {days} handelsdagen waren groen.", { green: p.green, days: p.days });
    case "low_sample":
      return tr("Je hebt maar {n} trades gelogd. Conclusies zijn pas betrouwbaar vanaf ongeveer 20 trades.", { n: p.n });
    default:
      return "";
  }
}

export function habitText(h) {
  if (!h) return "";
  return h.id === "mood_logged"
    ? tr("Je vulde bij {pct} van je trades je emotie in. Daardoor worden je patronen betrouwbaarder.", { pct: pct(h.p.share) })
    : tr("Bij maar {pct} van je trades vulde je je emotie in. Vul het elke keer in, anders kan ik geen patroon laten zien.", { pct: pct(h.p.share) });
}

// De openingszin: eindresultaat en, als er een vorige periode is, de vergelijking daarmee.
export function headlineText(h, kind) {
  const base = insightText(h, kind);
  if (h.p.delta == null || Math.abs(h.p.delta) < 1) return base;
  const prev = previousLabel(kind);
  return `${base} ${h.p.delta > 0 ? tr("Dat is {delta} beter dan {prev}.", { delta: money(h.p.delta, { dec: 0 }), prev }) : tr("Dat is {delta} slechter dan {prev}.", { delta: money(Math.abs(h.p.delta), { dec: 0 }), prev })}`;
}

// De concrete opdracht voor de volgende periode.
export function focusText(f, kind) {
  const p = f.p || {};
  const next = kind === "week" ? tr("de komende week") : tr("de komende maand");
  switch (f.id) {
    case "worst_mood":
      return tr("Neem {next} geen trades als je je ‘{mood}’ voelt.", { next, mood: tr(p.mood) });
    case "worst_setup":
      return tr("Trade de setup ‘{setup}’ {next} alleen met extra bevestiging.", { next, setup: tr(p.setup) });
    case "worst_weekday":
      return tr("Wees op {day} selectiever en sla twijfelgevallen over.", { day: weekdayLong(p.dow) });
    case "worst_hour":
      return tr("Wees rond {hour}:00 selectiever en sla twijfelgevallen over.", { hour: p.hour });
    case "payoff_poor":
      return tr("Houd je gemiddelde verlies kleiner dan je gemiddelde winst.");
    case "winrate_below_needed":
      return tr("Neem alleen trades die aan al je regels voldoen, en sla de rest over.");
    case "size_inconsistent":
    case "size_up_after_loss":
      return tr("Houd je positiegrootte vast: dezelfde grootte bij elke trade, ook na een verlies.");
    case "overtrading":
      return tr("Zet een maximum van {n} trades per dag en stop daarna.", { n: Math.max(3, (p.n || 6) - 1) });
    case "loss_streak":
      return tr("Stop na 3 verliezen op rij en pak de volgende dag opnieuw op.");
    case "outlier_loss":
      return tr("Leg bij elke trade je stop vooraf vast en verplaats hem niet.");
    case "drawdown_deep":
      return tr("Verklein je risico per trade tot je weer boven je laagste punt zit.");
    case "mood_missing":
      return tr("Vul bij elke trade je emotie in, zodat je patronen zichtbaar worden.");
    case "net_negative":
      return tr("Kies één punt uit de lijst hierboven en let daar {next} op.", { next });
    default:
      return tr("Blijf doen wat werkt en blijf elke trade journalen.");
  }
}

// Een kant-en-klaar bericht voor WhatsApp (vet met *sterretjes*).
export function reportShareText(report, { name, label }) {
  const d = report.data;
  const k = d.kpis;
  const lines = [];
  lines.push(name ? tr("📊 *{label}* — {name}", { label, name }) : tr("📊 *{label}*", { label }));
  lines.push(
    tr("Resultaat {usd} ({r}) · {n} trades · win % {wr} · profit factor {pf}", {
      usd: usd(k.net),
      r: rr(k.netR),
      n: k.trades,
      wr: pct(k.winRate),
      pf: k.profitFactor == null ? "—" : fixed(k.profitFactor, 2),
    })
  );
  const good = [...d.good.map((i) => insightText(i, d.kind)), ...(d.habit && d.habit.tone === "good" ? [habitText(d.habit)] : [])];
  const improve = [...d.improve.map((i) => insightText(i, d.kind)), ...(d.habit && d.habit.tone === "improve" ? [habitText(d.habit)] : [])];
  if (good.length) lines.push("", tr("✅ *Wat gaat goed*"), ...good.map((t) => `• ${t}`));
  if (improve.length) lines.push("", tr("⚠️ *Waar kun je verbeteren*"), ...improve.map((t) => `• ${t}`));
  lines.push("", tr("🎯 *Focus*: {focus}", { focus: focusText(d.focus, d.kind) }));
  return lines.join("\n");
}

