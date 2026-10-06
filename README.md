# DCRAMERE Journal

🇳🇱 Een trading journal voor futures-handelaren, in het Nederlands én Engels (schakelaar **NL | EN** rechtsboven).
🇬🇧 A trading journal for futures traders, in Dutch and English (**NL | EN** switch top right).

**Vier tabbladen / Four tabs**

| Tab | NL | EN |
|---|---|---|
| **Import** | Accounts (live/prop/paper/backtest), startsaldo, risico per trade, stortingen/opnames, CSV-import (Tradovate), back-up en herstel | Accounts, starting balance, risk per trade, deposits/withdrawals, CSV import (Tradovate), backup and restore |
| **Journal** | Kerncijfers, jaar- en maandkalender, grafieken (win %, expectancy, drawdown, positiegrootte, dagresultaat, houdtijd, tijdstip, cumulatief) | Key figures, year and month calendar, charts (win %, expectancy, drawdown, position size, daily result, hold time, time of day, cumulative) |
| **Trades** | Alle trades per dag, filteren, details, bewerken, screenshot, CSV-export | All trades by day, filters, details, editing, screenshots, CSV export |
| **Stats** | Streaks, per weekdag/uur/contract/richting/**emotie**/setup, tijd tot doel, groeitempo, Monte Carlo, kans op ruïne, Kelly | Streaks, by weekday/hour/contract/direction/**emotion**/setup, time to target, growth rate, Monte Carlo, risk of ruin, Kelly |

Bovenin: filter op **periode** en **account**, en schakel alles tussen **$ / % / R**.
At the top: filter by **period** and **account**, and switch everything between **$ / % / R**.

**Belangrijk om te weten / Important:** alles wordt bewaard in `localStorage`, dus lokaal in de browser van elke
bezoeker. Er is geen gedeelde database — trades op je telefoon staan niet automatisch op je laptop, en als je
browserdata wist ben je je journal kwijt. Download daarom regelmatig een back-up (tabblad Import).
Everything is stored in `localStorage` in each visitor's own browser. There is no shared database — trades on your
phone are not on your laptop, and clearing browser data wipes the journal. Download a backup regularly (Import tab).

## Hoe gebruik je de journal / How to use it

**NL**

1. **Import** — pas je account aan (startsaldo, gepland risico per trade) en sleep je Tradovate-export
   (*Performance* of *Orders*, CSV) in het vak. Dubbele trades worden overgeslagen. Zet de tijdzone van het bestand goed.
2. **Handmatig loggen** — knop **+ Trade**. Symbool, richting, aantal en resultaat ($ of R). Met entry, exit en aantal van een
   bekend contract (MNQ, ES, NQ, MES, …) rekent de app het resultaat zelf uit, inclusief commissie.
3. **Emotionele toestand** — vink vóór de trade aan hoe je je voelde (Rustig, Zelfverzekerd, Onzeker, Ongeduldig,
   Gefrustreerd, Wraakzuchtig). In Journal en Stats zie je per stemming je gemiddelde resultaat.
4. **Bekijken** — Journal voor het overzicht, klik een dag in de kalender om zijn trades te zien; Trades voor details en
   notities; Stats voor patronen. Monte Carlo, kans op ruïne en Kelly verschijnen pas vanaf 100 trades.

**EN**

1. **Import** — adjust your account (starting balance, planned risk per trade) and drop your Tradovate export
   (*Performance* or *Orders*, CSV) in the box. Duplicate trades are skipped. Set the file's time zone correctly.
2. **Log by hand** — the **+ Trade** button. Symbol, direction, quantity and result ($ or R). With entry, exit and quantity of a
   known contract (MNQ, ES, NQ, MES, …) the app calculates the result itself, commission included.
3. **Emotional state** — tick how you felt before the trade (Calm, Confident, Unsure, Impatient, Frustrated,
   Revenge-driven). Journal and Stats show your average result per mood.
4. **Review** — Journal for the overview, click a day in the calendar to see its trades; Trades for details and notes;
   Stats for patterns. Monte Carlo, risk of ruin and Kelly appear from 100 trades.

**Hoe rekent de app / How the numbers work**

- R = resultaat ÷ je geplande risico per trade / R = result ÷ your planned risk per trade. % = resultaat ÷ startsaldo
  (of huidig saldo bij *Samengesteld* / or current balance in *Compounding* mode).
- Groeitempo is tijdgewogen: stortingen en opnames tellen niet mee als winst / Growth rate is time-weighted: deposits and
  withdrawals do not count as profit.
- Tijdzone (standaard America/New_York) bepaalt op welke dag, uur en weekdag een trade valt / The time zone (default
  America/New_York) decides which day, hour and weekday a trade falls on.

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
    ├── main.jsx        # React entry point
    ├── App.jsx         # Shell: tabs, filters, taalwissel / tabs, filters, language switch
    ├── i18n.js         # tr() + taalkeuze / language selection
    ├── i18n-en.js      # Engelse vertalingen (sleutel = Nederlandse tekst) / English translations
    ├── theme.js        # Kleuren, moods, setups, periodes
    ├── storage.js      # localStorage-laag (get/set/delete)
    ├── lib/            # Rekenlaag (metrics, csv, tijdzones, formattering) / calculation layer
    ├── state/          # useJournal (opslag) en useScope (filters + statistieken)
    ├── views/          # Import, Journal, Trades, Stats
    ├── components/     # Kalender, trade-formulier, filterbalk
    └── ui/             # Kaarten, knoppen, grafieken (SVG, zonder externe library)
```
