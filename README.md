# DCRAMERE Journal

Een simpele trading journal — logt je trades (symbool, richting, entry/exit,
positiegrootte, resultaat in R, setup, fout/les en een screenshot) en
berekent automatisch je win rate, gemiddelde R en netto R.

**Belangrijk om te weten:** deze versie bewaart alles in `localStorage`, dus
lokaal in de browser van elke bezoeker. Er is geen gedeelde database — jouw
trades op je telefoon staan dus niet automatisch ook op je laptop, en als je
browserdata wist, ben je je journal kwijt. Voor een echte multi-user versie
met een centrale database heb je een backend nodig (zoals de DCRAMERE
Journal-SaaS die al in ontwikkeling is).

## Hoe gebruik je de journal

### Een trade loggen

1. Vul minimaal een **symbool** (bijv. `BTCUSDT`) en het **resultaat in R** in
   (bijv. `1.5` voor 1,5R winst, `-1` voor 1R verlies) — dit zijn de enige
   twee verplichte velden.
2. De rest is optioneel maar levert betere data op voor de inzichten
   verderop:
   - **Richting**: Long of Short.
   - **Entry / Exit / Positiegrootte**: voor je eigen naslag, tellen niet mee
     in de berekeningen.
   - **Reden (Handelsweg-stap)**: welk setup-type de trade triggerde. Bepaalt
     de "Win rate per reden"-grafiek.
   - **Fout / les**: een korte notitie — waardevol bij het terugkijken.
   - **Emotionele toestand**: hoe je je voelde vóór je de trade nam (Rustig,
     Zelfverzekerd, Onzeker, Ongeduldig, Gefrustreerd, Wraakzuchtig). Log dit
     zo eerlijk mogelijk — dit is de basis van de "Gem. R per emotionele
     toestand"-grafiek, waarmee je ziet welke gemoedstoestanden je geld
     kosten (bijv. wraaktrades na een verlies).
   - **Screenshot**: voeg een chart-screenshot toe; wordt automatisch
     verkleind en apart opgeslagen.
3. Klik **Trade loggen**. De trade verschijnt bovenaan de lijst en de
   statistieken (Trades, Win rate, Gem. R, Netto R) updaten direct.

### Trades bekijken en beheren

- Elke trade in de lijst toont symbool, richting, resultaat, reden en (als
  ingevuld) je stemming en les.
- Klik op **Screenshot bekijken** om een bijgevoegde chart-afbeelding te
  tonen.
- Klik op het prullenbak-icoon om een trade permanent te verwijderen
  (inclusief screenshot) — dit kan niet ongedaan worden gemaakt.

### Inzichten & patronen

Onderaan de pagina staat een sectie die automatisch patronen in je data
blootlegt:

- **Equity curve**: je cumulatieve R-resultaat over tijd. Tik of hover op een
  punt voor de details van die specifieke trade. Bij 0 trades zie je een
  lege curve als placeholder.
- **Gem. R per emotionele toestand**: groene balken = gemiddeld winstgevend,
  rode balken = gemiddeld verlieslatend per gelogde stemming. Zo zie je
  zwart-op-wit welke emoties je edge ondermijnen.
- **Win rate per reden**: welke Handelsweg-stappen/setups daadwerkelijk
  raak zijn, gesorteerd van hoog naar laag.

Bij minder dan 5 trades toont de app een waarschuwing dat de patronen nog
niet statistisch betrouwbaar zijn — hoe meer je logt, hoe scherper het
beeld.

### Data kwijtraken voorkomen

Alles staat in `localStorage` van de browser waarin je logt (zie
waarschuwing hierboven). Log je trades dus consistent vanaf hetzelfde
apparaat/dezelfde browser, of exporteer periodiek handmatig als je dat
belangrijk vindt (nog geen ingebouwde export-knop).

## Lokaal draaien

```bash
npm install
npm run dev
```

Open daarna de URL die Vite in je terminal toont (meestal `http://localhost:5173`).

## Naar GitHub pushen

```bash
git init
git add .
git commit -m "Init DCRAMERE Journal"
git branch -M main
git remote add origin https://github.com/<jouw-gebruikersnaam>/<repo-naam>.git
git push -u origin main
```

Maak de lege repo eerst aan op github.com (zonder README/gitignore, die heb je al).

## Deployen op Vercel

1. Ga naar [vercel.com](https://vercel.com) en log in met je GitHub-account.
2. Klik **Add New → Project** en kies de repo.
3. Vercel herkent Vite automatisch (build command `npm run build`, output
   directory `dist`) — je hoeft niets aan te passen.
4. Klik **Deploy**. Na een minuut krijg je een live URL
   (bijv. `dcramere-journal.vercel.app`).

## Deployen op Netlify

1. Ga naar [netlify.com](https://netlify.com) en log in met je GitHub-account.
2. Klik **Add new site → Import an existing project** en kies de repo.
3. Vul in:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Klik **Deploy site**.

## Project structuur

```
dcramere-journal/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx      # React entry point
    ├── App.jsx        # De journal-tool zelf
    ├── storage.js     # localStorage-laag (get/set/delete)
    └── index.css      # Tailwind
```
