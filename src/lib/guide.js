// De inhoud van de handleiding, gedeeld door de app (HelpPanel.jsx) en het PDF-script (scripts/make-guide-pdf.mjs).
// Nederlands is de bron; de Engelse tekst staat in i18n-en.js. Pas je een functie aan, werk dan deze tekst bij
// en draai `npm run guide:pdf` om de PDF's te vernieuwen.
// T() markeert tekst voor de vertaalcontrole (npm run i18n:check); vertalen gebeurt bij het tonen.
const T = (s) => s;

// Kopjes met <b>vet</b>; een regel die met "• " begint wordt een opsommingsteken.
export const GUIDE_SECTIONS = [
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
      T("• <b>Het vraagteken</b> naast een kerncijfer legt uit wat het getal betekent, met jouw eigen bedragen erin. De kleur volgt je totale resultaat."),
      T("• <b>Nieuws</b>: een goud puntje in de kalender betekent dat die dag Amerikaans nieuws gepland staat (CPI, banenrapport, Fed-besluit en meer). Beweeg over de dag voor de naam. De kaart <b>Nieuws vooruit</b> toont de komende 7 dagen, tijden in New York."),
      T("• <b>Je dashboard aanpassen</b>: kies <b>Indelen / widget toevoegen</b> boven de kerncijfers. Verplaats widgets met de pijltjes, verberg wat je niet nodig hebt, zet het terug met het plusje en <b>sla je indeling op onder een naam</b>. Daarna wissel je met één klik tussen je indelingen. Dit geldt alleen in je eigen browser."),
    ],
  },
  {
    id: "trades",
    title: T("Tabblad Trades"),
    body: [
      T("• Alle trades per dag, met het resultaat per dag. <b>Klik een trade</b> voor details, je les en je screenshot."),
      T("• Klik een trade voor ook <b>instap en uitstap, tijden, duur en fills</b>. Een trade die over meerdere dagen liep toont <b>‘dagen later’</b>."),
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
      T("• <b>Op nieuwsdagen</b>: hoe je trades uitpakken op dagen met geplande nieuwsberichten, per soort bericht."),
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

export const GUIDE_ADMIN_SECTION = {
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
