import React, { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COLORS, MONO } from "./theme.js";
import { tr } from "./i18n.js";
import { Modal } from "./ui/primitives.jsx";
import { Rich } from "./ui/Rich.jsx";

// T() markeert tekst voor de vertaalcontrole (npm run i18n:check); vertalen gebeurt bij het tonen.
const T = (s) => s;

// Kopjes met <b>vet</b>; een regel die met "• " begint wordt een opsommingsteken.
const SECTIONS = [
  {
    id: "start",
    title: T("Snel starten"),
    body: [
      T("1. <b>Maak een account</b> (of log in). Zonder inlog blijft alles alleen in deze browser staan."),
      T("2. Open het tabblad <b>Import</b>: pas je account aan (naam, <b>startsaldo</b>, <b>gepland risico per trade</b>) en sleep je Tradovate-export in het vak. Of log trades zelf met <b>+ Trade</b> rechtsboven."),
      T("3. Vink bij elke trade je <b>emotie</b> aan, en schrijf een korte <b>les</b> als er iets te leren valt."),
      T("4. Kijk bij <b>Journal</b> naar je cijfers, bij <b>Stats</b> naar patronen en bij <b>Rapport</b> naar wat goed gaat en wat beter kan."),
    ],
  },
  {
    id: "log",
    title: T("Een trade loggen (+ Trade)"),
    body: [
      T("• <b>Account, datum, open- en sluittijd</b>: de tijden zijn optioneel. De tijdzone staat in je journalinstellingen en bepaalt op welke dag, uur en weekdag de trade valt."),
      T("• <b>Richting</b>: Long of Short. <b>Symbool</b>: bijvoorbeeld MNQ of ES. <b>Aantal contracten</b>: standaard 1."),
      T("• <b>Entry en exit</b> zijn optioneel. Vul je ze in bij een bekend contract (MNQ, MES, NQ, ES, YM, RTY, CL, GC en meer), dan <b>rekent de app het resultaat zelf uit</b>, inclusief commissie. Laat daarvoor het resultaat leeg."),
      T("• <b>Resultaat in $ (netto)</b> of <b>in R</b>: vul er één in. Met alleen R rekent de app het om naar dollars met je geplande risico."),
      T("• <b>Kosten</b>: leeg laten gebruikt de commissie van je account."),
      T("• <b>Setup</b>: kies welke setup je handelde. Dat voedt de uitsplitsing per setup."),
      T("• <b>Screenshot</b>: voeg een afbeelding van je chart toe. Hij wordt automatisch verkleind."),
    ],
  },
  {
    id: "emotion",
    title: T("Emotie en notities"),
    body: [
      T("• Kies vóór de trade hoe je je voelt: <b>Rustig, Zelfverzekerd, Onzeker, Ongeduldig, Gefrustreerd</b> of <b>Wraakzuchtig</b>. Tik nog eens op je keuze om hem te wissen."),
      T("• In het veld <b>Fout / les</b> schrijf je wat goed ging of wat je ervan leert."),
      T("• Achteraf aanvullen kan: <b>Trades</b> → klik een trade → <b>Bewerken</b>. Geïmporteerde trades hebben geen emotie, die vul je zo aan."),
      T("• Je ziet het terug bij <b>Journal</b> (Emotie en resultaat), bij <b>Stats</b> (Per emotionele toestand) en in je <b>Rapport</b>. Hoe vaker je het invult, hoe betrouwbaarder de patronen."),
    ],
  },
  {
    id: "import",
    title: T("Import en accounts"),
    body: [
      T("• <b>Tradovate-export importeren</b>: sleep een CSV (Performance of Orders) op een account of kies <b>Kies een bestand</b>. Zet de tijdzone van het bestand goed. Trades die je al had, worden overgeslagen. Ook de CSV-export van dit journal wordt herkend."),
      T("• <b>Orders</b> worden per positie samengevoegd: meerdere fills worden één trade."),
      T("• <b>Nieuw account</b>: voor een live-, prop-, paper- of backtestaccount, elk met eigen startsaldo en risico."),
      T("• <b>Instellingen</b> per account: naam, broker, startsaldo, commissie per contract, type, <b>gepland risico per trade</b> (in % of $) en de risicomodus <b>Vast</b> of <b>Samengesteld</b> (risico groeit mee met je saldo)."),
      T("• <b>Stortingen en opnames</b> tellen mee in je saldo, maar niet als winst of verlies."),
      T("• <b>Account verwijderen</b>: de prullenbak rechtsboven op de kaart. <b>Lege accounts opruimen</b> verwijdert alle accounts zonder trades in één keer. Verwijderen kan niet ongedaan worden gemaakt."),
      T("• <b>Back-up en herstel</b> (onderaan): download alles als JSON, inclusief screenshots, en herstel het later of op een ander apparaat."),
    ],
  },
  {
    id: "journal",
    title: T("Tabblad Journal"),
    body: [
      T("• <b>Kerncijfers</b>: saldo en resultaat, win %, gemiddelde winst tegenover gemiddeld verlies, profit factor, expectancy en gemiddelde R."),
      T("• <b>Jaaroverzicht en maandkalender</b>: elke dag in groen of rood. Wissel met de knoppen tussen <b>P&L, Trades, Win % en Gem. W/V</b>. Klik een dag om zijn trades te zien."),
      T("• <b>Recente trades</b> en <b>Emotie en resultaat</b> (gemiddeld resultaat per emotie)."),
      T("• <b>Grafieken</b>: win %, winst-tegenover-verliesverhouding, expectancy, drawdown (hoe ver je onder je hoogste punt zat), positiegrootte, netto dagresultaat, resultaat per houdtijd en per tijdstip, en je cumulatieve resultaat. Beweeg of tik op een grafiek voor de waarden."),
    ],
  },
  {
    id: "trades",
    title: T("Tabblad Trades"),
    body: [
      T("• Alle trades per dag, met het resultaat per dag. <b>Klik een trade</b> voor details, je les en je screenshot."),
      T("• <b>Bewerken</b> en <b>Verwijderen</b> staan in de details van een trade."),
      T("• <b>Filter deze trades</b>: zoek op symbool of notitie, of filter op richting, uitkomst, setup of emotie. Een dag uit de kalender kiezen filtert ook. <b>Wis filters</b> zet alles terug."),
      T("• <b>Download CSV</b> (onderaan) bewaart al je trades als spreadsheet."),
    ],
  },
  {
    id: "stats",
    title: T("Tabblad Stats"),
    body: [
      T("• <b>Jaar in één oogopslag</b>, cumulatief resultaat, accountsaldo en drawdown."),
      T("• <b>Reeksen</b>: je langste winst- en verliesreeksen."),
      T("• <b>Jouw statistieken</b>: resultaat, dagen, de trades zelf, maanden, reeksen en drawdown in één overzicht."),
      T("• <b>Uitsplitsingen</b> per weekdag, uur, contract, richting, emotie en setup. Wissel de weergave tussen <b>Win %, Netto, Gem. winst, Gem. verlies, Gem. duur</b> en <b>Overzicht</b>."),
      T("• <b>Tijd tot doel</b> en <b>Effectieve groeisnelheid</b>: wanneer je een dollardoel haalt als je tempo gelijk blijft. Het is een hypothese, geen voorspelling."),
      T("• <b>Monte Carlo, Kans op ruïne</b> en <b>Kelly-criterium</b> verschijnen pas vanaf 100 trades. Daarvoor is de steekproef te klein om iets te zeggen."),
    ],
  },
  {
    id: "report",
    title: T("Tabblad Rapport"),
    body: [
      T("• Per afgeronde week en maand maakt de app automatisch een rapport uit je trades, met vaste regels (geen AI)."),
      T("• Je ziet een <b>openingszin</b> met je resultaat, <b>Wat gaat goed</b>, <b>Waar kun je verbeteren</b> en één <b>focus</b> voor de komende periode."),
      T("• Het kijkt naar je beste en slechtste emotie, setup, weekdag en uur, uitschieters in verlies, wisselende positiegrootte, groter inzetten na een verlies, te veel trades op een dag en verliesreeksen."),
      T("• <b>Kopieer als tekst</b> of <b>Deel via WhatsApp</b> stuurt het rapport door. Wissel boven tussen <b>Wekelijks</b> en <b>Maandelijks</b> en kies een eerdere periode."),
      T("• Een rapport verschijnt pas als de week of maand voorbij is en je daarin trades hebt gelogd."),
    ],
  },
  {
    id: "units",
    title: T("Filters en eenheden"),
    body: [
      T("• Bovenin Journal, Trades en Stats kies je de <b>periode</b> (alle tijd, 7 of 30 dagen, deze of vorige maand, dit jaar) en het <b>account</b>."),
      T("• De knop <b>$ / % / R</b> schakelt elk cijfer en elke grafiek: dollars, procent van je account of R-veelvouden van je geplande risico."),
      T("• <b>R</b> is je resultaat gedeeld door je geplande risico per trade. <b>%</b> is je resultaat gedeeld door je startsaldo (bij Samengesteld: je huidige saldo)."),
      T("• Rechtsboven wissel je tussen <b>NL en EN</b>. De taal wordt onthouden."),
    ],
  },
  {
    id: "account",
    title: T("Je account, privacy en data"),
    body: [
      T("• <b>Inloggen</b> kan op elk apparaat; je data staat dan in je account. Zonder account staat alles alleen in deze browser, dus maak regelmatig een back-up."),
      T("• <b>Wachtwoord kwijt?</b> Gebruik ‘Wachtwoord vergeten?’ op het inlogscherm als dat er staat, of vraag je coach om een resetlink. Met de link kies je een nieuw wachtwoord; je wordt overal uitgelogd."),
      T("• <b>Privacy</b>: je coach kan je journal alleen lezen, niet aanpassen. Onder <b>Import → Privacy en account</b> zie je wanneer je coach heeft gekeken of een resetlink heeft gemaakt."),
      T("• <b>Account verwijderen</b>: dezelfde kaart. Dat wist je account en al je trades, screenshots en rapporten definitief."),
      T("• Had je al een lokaal journal in deze browser, dan biedt de app na het inloggen aan om het in je account te zetten."),
    ],
  },
];

const ADMIN_SECTION = {
  id: "admin",
  title: T("Voor beheerders (coach)"),
  body: [
    T("• Via <b>Klanten</b> rechtsboven open je het dashboard (<b>#/admin</b>): aantal klanten, wie recent actief was, en per klant laatst ingelogd, laatste trade, trades, win % en resultaat over 30 dagen en totaal. Zoek, sorteer en filter op status."),
    T("• <b>Open</b> toont het volledige journal van een klant, <b>alleen lezen</b>, met een gouden balk bovenaan. Elk bezoek wordt vastgelegd en is zichtbaar voor de klant."),
    T("• <b>Resetlink</b> maakt een link (24 uur geldig, één keer te gebruiken) die je zelf naar de klant stuurt, bijvoorbeeld via WhatsApp. Dit wordt ook vastgelegd en is voor de klant zichtbaar."),
    T("• <b>Deactiveren</b> logt een klant direct uit en blokkeert inloggen; <b>Activeren</b> zet het terug. De klant en zijn data blijven bewaard."),
    T("• Bovenaan staan de <b>weekrapporten van alle klanten</b>, met sterkste punt, zwakste punt en focus. <b>Rapport</b> opent het volledige rapport, <b>WhatsApp</b> maakt een kant-en-klare tekst."),
    T("• Als e-mail is ingesteld, krijg je een melding bij elke nieuwe klant."),
  ],
};

function Body({ line }) {
  // Eerst vertalen (de sleutel bevat het bolletje), dan pas het bolletje weghalen.
  const translated = tr(line);
  const bullet = translated.startsWith("• ");
  const text = bullet ? translated.slice(2) : translated;
  return (
    <li className={`flex gap-2 ${bullet ? "" : "list-none"}`} style={{ listStyle: "none" }}>
      {bullet && (
        <span aria-hidden="true" style={{ color: COLORS.gold }}>
          •
        </span>
      )}
      <span>
        <Rich k={text} done />
      </span>
    </li>
  );
}

const plain = (s) => tr(s).replace(/<\/?(b|g|red|green)>/g, "").toLowerCase();

export default function HelpPanel({ onClose, isAdmin = false }) {
  const sections = useMemo(() => (isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS), [isAdmin]);
  const [open, setOpen] = useState(() => new Set(["start"]));
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const visible = useMemo(
    () => (needle ? sections.filter((s) => plain(s.title).includes(needle) || s.body.some((l) => plain(l).includes(needle))) : sections),
    [sections, needle]
  );
  const isOpen = (id) => Boolean(needle) || open.has(id);
  const allOpen = open.size >= sections.length;

  const toggle = (id) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal title={tr("Hoe gebruik je de journal")} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label
          className="flex items-center gap-2 flex-1 min-w-40 rounded-lg px-3 py-1.5 text-xs"
          style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.textMuted }}
        >
          <Search size={14} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Zoek in de handleiding")}
            aria-label={tr("Zoek in de handleiding")}
            className="bg-transparent outline-none flex-1 min-w-0"
            style={{ color: COLORS.text }}
          />
        </label>
        {!needle && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.id)))}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
          >
            {allOpen ? tr("Alles inklappen") : tr("Alles openen")}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: COLORS.textMuted }}>
          {tr("Niets gevonden. Probeer een ander woord.")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((s) => {
            const expanded = isOpen(s.id);
            return (
              <section key={s.id} className="rounded-lg" style={{ background: COLORS.inputBg, border: `1px solid ${expanded ? COLORS.cardBorder : COLORS.grid}` }}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-expanded={expanded}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="text-sm font-semibold" style={{ color: s.id === "admin" ? COLORS.gold : COLORS.text }}>
                    {tr(s.title)}
                  </span>
                  <ChevronDown size={14} style={{ color: COLORS.textMuted, transform: expanded ? "rotate(180deg)" : "none" }} />
                </button>
                {expanded && (
                  <ul className="px-3 pb-3 flex flex-col gap-2 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                    {s.body.map((line) => (
                      <Body key={line} line={line} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[11px] mt-3" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
        {tr("Kom je er niet uit? Vraag het je coach.")}
      </p>
    </Modal>
  );
}
