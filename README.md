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

## Klanten, accounts en beheerder / Clients, accounts and admin

**NL** — Met een database (Neon Postgres) krijgt elke klant een eigen account met e-mail en wachtwoord. Jij, als beheerder,
ziet alle klanten op `#/admin`: laatst ingelogd, laatste trade, aantal trades, win % en resultaat (30 dagen en totaal). Klik op
*Open* om het volledige journal van een klant te bekijken, **alleen lezen**. Zonder database blijft de app gewoon in de lokale
modus werken (alles in de browser, zonder inlog), zoals voorheen.

**EN** — With a database (Neon Postgres) every client gets their own account with email and password. You, as admin, see all
clients at `#/admin`: last login, last trade, trade count, win % and result (30 days and total). Click *Open* to view a client's
full journal, **read only**. Without a database the app keeps running in local mode (everything in the browser, no login) as before.

**Privacy / Privacy**

- Klanten geven bij het aanmaken van hun account expliciet akkoord dat de beheerder meekijkt. / Clients explicitly consent when signing up.
- Elk bezoek van de beheerder aan een klantjournal wordt vastgelegd (max. 1 regel per 10 min per klant) en is voor de klant zichtbaar
  onder *Import → Privacy en account*. / Every admin visit is logged and visible to the client.
- Klanten kunnen hun account en alle data zelf verwijderen. / Clients can delete their account and all data themselves.
- De beheerder kan klanten deactiveren (direct uitgelogd) maar niets in hun journal wijzigen. / The admin can deactivate clients but cannot edit their journals.

### Eenmalig instellen / One-time setup

1. **Database** — Vercel → je project → *Storage* → *Create Database* → **Neon (Postgres)** en koppel die aan het project. Vercel zet dan zelf
   `DATABASE_URL`. / Add a Neon Postgres database to the project; Vercel sets `DATABASE_URL` for you.
2. **Setup-code** — Vercel → *Settings → Environment Variables* → voeg `ADMIN_SETUP_TOKEN` toe met een lange willekeurige waarde
   (Production én Preview). Genereer er een met: / Add `ADMIN_SETUP_TOKEN` with a long random value:

   ```bash
   openssl rand -base64 32
   ```

3. **Opnieuw deployen** — de build draait automatisch de databasemigraties (`vercel-build` → `scripts/migrate.mjs`). / Redeploy; the
   build runs the migrations automatically.
4. **Beheerder aanmaken** — open `https://<jouw-site>/#/setup`, vul naam, e-mail, wachtwoord en de setup-code in. Daarna is dit
   scherm gesloten: er kan nooit een tweede beheerder via de setup-code bij. / Open `/#/setup` and create the admin; it closes
   itself once an admin exists.

5. **E-mail voor "wachtwoord vergeten" (optioneel; heb je geen domein, sla dit over en gebruik de resetlink van de beheerder) / Email for "forgot password" (optional; without a domain skip this and use the admin reset link)** — maak een account op
   [resend.com](https://resend.com), verifieer je domein (DNS-records) en maak een API-key. Voeg daarna in Vercel toe: /
   Create a Resend account, verify your domain and create an API key. Then add in Vercel:

   | Variabele / Variable | Waarde / Value |
   |---|---|
   | `RESEND_API_KEY` | de API-key uit Resend / the API key from Resend |
   | `MAIL_FROM` (of / or `RESEND_FROM_EMAIL`) | `DCRAMERE Journal <journal@jouwdomein.nl>` (een adres op je geverifieerde domein / an address on your verified domain) |
   | `APP_URL` | `https://dcramere-journal.vercel.app` (of je eigen domein / or your own domain) |

   Zolang deze variabelen ontbreken, ziet de klant de link "Wachtwoord vergeten?" niet. Het afzenderadres
   `onboarding@resend.dev` van Resend bezorgt alleen aan je eigen Resend-adres; handig om de flow te proberen vóór je domein
   is geverifieerd. / Until these are set, the "Forgot your password?" link is hidden. Resend's `onboarding@resend.dev` sender only
   delivers to your own Resend address, which is handy for trying the flow before your domain is verified.

Zet de setup-code en de API-key **nooit** in de chat, in een screenshot of in de code; alleen in Vercel. Geef de key bij voorkeur alleen *Sending access* (niet *Full access*). / Never put the setup code or the API key in chat, screenshots or code; only in Vercel. Prefer *Sending access* over *Full access* for the key.

**Hoe wachtwoord vergeten werkt / How forgot-password works:** de klant vraagt een link aan; de app antwoordt altijd hetzelfde (ook bij een
onbekend adres) en mailt, als het account bestaat, een link die 1 uur geldig is en één keer werkt. Het token staat alleen als hash in de
database en in het URL-fragment (`#/reset?token=…`), dus het komt niet in serverlogs. Na het kiezen van een nieuw wachtwoord wordt de klant
overal uitgelogd, een eventuele inlogblokkade wordt opgeheven en er gaat een "wachtwoord gewijzigd"-mail uit. Maximaal 3 aanvragen per uur
per e-mailadres. / The client requests a link; the app always answers the same (even for unknown addresses) and emails a 1-hour, single-use
link if the account exists. Only a hash is stored; the token lives in the URL fragment so it never reaches server logs. After resetting, all
sessions are revoked, any login lockout is lifted and a "password changed" notice is sent. Max 3 requests per hour per address.

**Zonder e-mail: resetlink van de beheerder / Without email: admin reset link** — in `#/admin` staat bij elke klant een knop *Resetlink*.
Die maakt een eenmalige link (24 uur geldig) die jij zelf doorstuurt, bijvoorbeeld via WhatsApp. Met de link kiest de klant een nieuw
wachtwoord en wordt overal uitgelogd. Zolang e-mail niet is ingesteld, ziet de klant op het inlogscherm "Vraag je coach om een resetlink".
Dit is de enige plek waar de beheerder meer kan dan lezen (met zo'n link kun je een account in principe overnemen); daarom wordt elke
link vastgelegd, is hij zichtbaar voor de klant onder *Privacy en account*, en stemt de klant bij het registreren hier expliciet mee in. /
In `#/admin` every client has a *Reset link* button that creates a single-use, 24-hour link you send yourself (e.g. via WhatsApp). It is the one
place where the admin can do more than read (such a link can in principle take over an account), so every link is logged, visible to the
client under *Privacy and account*, and the client consents to it at sign-up.

### Automatische rapporten / Automatic reports

**NL** — Elke klant krijgt per afgeronde week en maand een rapport met de openingszin (eindresultaat, en het verschil met de vorige periode), **wat goed
gaat**, **waar te verbeteren** en één **focus** voor de komende periode. Het wordt berekend uit de gelogde trades met vaste regels (geen AI; er verlaat
niets je database): de beste en slechtste emotie, setup, weekdag en uur (minstens 3 trades per groep), uitschieters in verlies, wisselende
positiegrootte, groter inzetten na een verlies (tilt), overtraden, verliesreeksen, terugval, en of je je emotie invult. In het tabblad **Rapport**
kan de klant het lezen, kopiëren of via WhatsApp delen. Als beheerder zie je in `#/admin` bovenaan het weekrapport van **alle klanten** met één
klik naar het volledige rapport en een kant-en-klare WhatsApp-tekst per klant.

**EN** — Every client gets a report for each completed week and month: a headline (result and the change versus the previous period), **what is going
well**, **where to improve** and one **focus** for the coming period. It is calculated from the logged trades with fixed rules (no AI; nothing leaves your
database). On the **Report** tab the client can read, copy or share it via WhatsApp. As admin, `#/admin` shows the weekly report of **all clients** at
the top, with one click to the full report and a ready-made WhatsApp text per client.

- **Wanneer / When:** rapporten worden gemaakt zodra iemand de app of het dashboard opent, en dagelijks om 06:00 UTC door een Vercel-cron
  (`vercel.json`). Komen er later nog trades bij (bijv. een import), dan wordt het rapport automatisch opnieuw berekend. / Reports are generated when
  someone opens the app or the dashboard, and daily at 06:00 UTC by a Vercel cron. If trades are added later, the report is recalculated.
- **Cron beveiligen (optioneel) / Securing the cron (optional):** zet `CRON_SECRET` in Vercel (een lange willekeurige waarde, bijv. `openssl rand -base64 32`).
  Vercel stuurt die automatisch mee; zonder `CRON_SECRET` doet de cron niets en worden rapporten alleen gemaakt als iemand de app opent. / Set
  `CRON_SECRET` in Vercel; without it the cron does nothing and reports are only created when someone opens the app.
- **Bezorging / Delivery:** in de app + WhatsApp-tekst via de beheerder. E-mail kan later zodra er een domein in Resend is geverifieerd. / In the app +
  WhatsApp text via the admin. Email can follow once a domain is verified in Resend.

### Hoe het werkt / How it works

- `api/[...path].js` is één Vercel-functie met een eigen router (`server/`). Wachtwoorden: scrypt. Sessies: willekeurig token in een
  HttpOnly-cookie (alleen de hash staat in de database), 30 dagen, direct intrekbaar. / One Vercel function, scrypt passwords,
  opaque session tokens in HttpOnly cookies.
- Schrijvende verzoeken vereisen een eigen header plus een kloppende `Origin` (CSRF-bescherming). Inloggen en registreren hebben
  limieten per IP en per e-mailadres. / CSRF header + origin check; rate limits on login and signup.
- Elke klant ziet alleen zijn eigen rijen (alle queries filteren op `user_id`; ids zijn per gebruiker uniek).
- Bestaand lokaal journal in de browser? Na het inloggen biedt de app aan om het in je account te importeren. / Existing local
  journal? After logging in the app offers to import it into your account.
- **Nog niet aanwezig / Not included yet:** e-mailverificatie bij registratie (het e-mailadres wordt nu niet bevestigd) en een wachtwoord wijzigen
  terwijl je ingelogd bent. Vrij registreren betekent dat iedereen met een link een account kan maken; de beheerder kan accounts deactiveren. /
  Email verification at sign-up and changing your password while logged in. Open sign-up means anyone with the link can register; the admin can
  deactivate accounts.

### Lokaal ontwikkelen / Local development

```bash
npm install
npm run dev        # Vite (5173) + lokale API (8787) op een ingebouwde Postgres (PGlite)
npm test           # rekenlogica, API-tests en vertaalcontrole
```

De lokale API gebruikt setup-code `dev-setup-token` en bewaart data in `.dev-db/` (niet in git). / The local API uses setup code
`dev-setup-token` and stores data in `.dev-db/` (git-ignored).

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
