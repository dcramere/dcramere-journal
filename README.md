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
