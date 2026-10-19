// Maakt de handleiding als PDF, in het Nederlands en Engels, uit dezelfde tekst als de app.  npm run guide:pdf
//   public/guide/   → voor klanten (wordt met de site gepubliceerd; de app linkt ernaar)
//   docs/           → coachversie met het onderdeel voor beheerders (niet openbaar)
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import PDFDocument from "pdfkit";
import { setLang, tr } from "../src/i18n.js";
import { GUIDE_ADMIN_SECTION, GUIDE_SECTIONS } from "../src/lib/guide.js";

// Lettertypen worden in de PDF ingesloten, zodat vet en serif in elke viewer hetzelfde zijn.
const FONT_DIR = (pkg) => resolve("node_modules/@fontsource", pkg, "files");
const FONTS = {
  Body: `${FONT_DIR("inter")}/inter-latin-400-normal.woff`,
  Bold: `${FONT_DIR("inter")}/inter-latin-700-normal.woff`,
  Serif: `${FONT_DIR("lora")}/lora-latin-700-normal.woff`,
};

const LOGO = resolve("scripts/assets/dcramere-logo.png");
const CREAM = "#F1ECDD";
const GOLD_LIGHT = "#D4AF37";

const URL_TEXT = "dcramere-journal.vercel.app";
const INK = "#1A1710";
const MUTED = "#6B6455";
const GOLD = "#9A7B1E";
const RULE = "#D9D2BE";

const WORDS = {
  nl: {
    tag: "SEE · DECIPHER · TRADE",
    cover: "Handleiding",
    coverCoach: "Handleiding voor coaches",
    title: "Handleiding",
    coachTitle: "Handleiding voor coaches",
    intro: "Alles wat je met het journal kunt, stap voor stap. De knop ‘Hoe werkt dit?’ in de app toont dezelfde uitleg.",
    contents: "Inhoud",
    page: (n, m) => `Pagina ${n} van ${m}`,
    foot: "Vragen? Vraag het je coach.",
  },
  en: {
    tag: "SEE · DECIPHER · TRADE",
    cover: "User guide",
    coverCoach: "Coach guide",
    title: "User guide",
    coachTitle: "Coach guide",
    intro: "Everything you can do with the journal, step by step. The ‘How does this work?’ button in the app shows the same explanation.",
    contents: "Contents",
    page: (n, m) => `Page ${n} of ${m}`,
    foot: "Questions? Ask your coach.",
  },
};

// De standaard PDF-lettertypen kennen geen pijltje; een lange hoek is hier even leesbaar.
const printable = (s) => s.replace(/→/g, "›");

// <b>…</b> (en de kleurtags van de app) naar tekstblokken met een vet/normaal-vlag.
function runs(text) {
  const out = [];
  const re = /<(b|g|red|green)>(.*?)<\/\1>/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), bold: false });
    out.push({ t: m[2], bold: true });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: text.slice(last), bold: false });
  return out.map((r) => ({ ...r, t: printable(r.t) }));
}

function build({ lang, admin, file }) {
  setLang(lang);
  const w = WORDS[lang];
  mkdirSync(dirname(file), { recursive: true });

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 58, left: 54, right: 54 },
    bufferPages: true,
    info: {
      Title: `DCRAMERE Journal — ${admin ? w.coachTitle : w.title}`,
      Author: "DCRAMERE",
      Subject: lang === "nl" ? "Handleiding" : "User guide",
      Keywords: "trading journal, DCRAMERE",
      Creator: "DCRAMERE Journal",
    },
  });
  for (const [name, path] of Object.entries(FONTS)) doc.registerFont(name, path);
  doc.pipe(createWriteStream(file));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const sections = admin ? [...GUIDE_SECTIONS, GUIDE_ADMIN_SECTION] : GUIDE_SECTIONS;

  const need = (h) => {
    if (doc.y + h > bottom()) doc.addPage();
  };

  // Omslag: zwart met het logo, in de huisstijl van de app.
  const W = doc.page.width;
  const H = doc.page.height;
  doc.rect(0, 0, W, H).fill("#000000");
  const logoSize = 360;
  doc.image(LOGO, (W - logoSize) / 2, 110, { width: logoSize });
  let y = 110 + logoSize + 26;
  doc.rect(W / 2 - 24, y, 48, 1.2).fill(GOLD_LIGHT);
  y += 26;
  doc.font("Serif").fontSize(34).fillColor(GOLD_LIGHT).text(admin ? w.coverCoach : w.cover, 0, y, { width: W, align: "center" });
  y = doc.y + 10;
  doc.font("Body").fontSize(12).fillColor(CREAM).text("DCRAMERE Journal", 0, y, { width: W, align: "center" });
  doc.font("Bold").fontSize(10.5).fillColor(GOLD_LIGHT).text(URL_TEXT, 0, H - 78, { width: W, align: "center", link: `https://${URL_TEXT}` });

  // Inhoud
  doc.addPage();
  doc.font("Serif").fontSize(26).fillColor(GOLD).text("DCRAMERE JOURNAL", left, doc.y, { characterSpacing: 1 });
  doc.moveDown(0.2);
  doc.font("Body").fontSize(8.5).fillColor(MUTED).text(w.tag, { characterSpacing: 2 });
  doc.moveDown(1.2);
  doc.font("Bold").fontSize(20).fillColor(INK).text(admin ? w.coachTitle : w.title);
  doc.moveDown(0.4);
  doc.font("Body").fontSize(10.5).fillColor(MUTED).text(w.intro, { width, lineGap: 2 });
  doc.moveDown(0.5);
  doc.font("Bold").fontSize(10.5).fillColor(GOLD).text(URL_TEXT, { link: `https://${URL_TEXT}`, underline: false });
  doc.moveDown(1.2);

  // Inhoud
  doc.font("Bold").fontSize(9).fillColor(MUTED).text(w.contents.toUpperCase(), { characterSpacing: 1.5 });
  doc.moveDown(0.4);
  sections.forEach((s, i) => {
    doc
      .font("Body")
      .fontSize(10.5)
      .fillColor(INK)
      .text(`${i + 1}.  ${printable(tr(s.title))}`, left + 6, doc.y, { width: width - 6, lineGap: 2 });
  });
  doc.moveDown(0.8);
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.6).strokeColor(RULE).stroke();
  doc.moveDown(1);

  const sizeBody = 9.2;
  const gap = 2.2;
  const indent = 14;

  const heightOf = (text, w2) => {
    // Bovengrens: alles vet gemeten, zodat een regel nooit onderaan de pagina wordt afgebroken.
    doc.font("Bold").fontSize(sizeBody);
    return doc.heightOfString(runs(text).map((r) => r.t).join(""), { width: w2, lineGap: gap });
  };

  sections.forEach((s, i) => {
    const lines = s.body.map((l) => tr(l));
    need(28 + heightOf(lines[0].replace(/^• /, ""), width - indent) + 8);
    doc.moveDown(0.4);
    doc.font("Bold").fontSize(13.5).fillColor(s.id === "admin" ? GOLD : INK).text(`${i + 1}.  ${printable(tr(s.title))}`, left, doc.y, { width });
    doc.moveDown(0.15);
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.moveDown(0.4);

    for (const line of lines) {
      const bullet = line.startsWith("• ");
      const text = bullet ? line.slice(2) : line;
      const x = bullet ? left + indent : left;
      const w2 = bullet ? width - indent : width;
      need(heightOf(text, w2) + 6);
      const y = doc.y;
      if (bullet) doc.font("Bold").fontSize(sizeBody).fillColor(GOLD).text("•", left + 2, y, { lineBreak: false });

      const parts = runs(text);
      parts.forEach((p, k) => {
        doc.font(p.bold ? "Bold" : "Body").fontSize(sizeBody).fillColor(p.bold ? INK : "#3B3628");
        const opts = { width: w2, lineGap: gap, continued: k < parts.length - 1 };
        if (k === 0) doc.text(p.t, x, y, opts);
        else doc.text(p.t, opts);
      });
      doc.moveDown(0.32);
    }
  });

  // Voet op elke pagina
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 38;
    doc.page.margins.bottom = 0; // zodat tekst in de voet geen nieuwe pagina forceert
    doc.moveTo(left, y - 8).lineTo(left + width, y - 8).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font("Body").fontSize(8).fillColor(MUTED);
    doc.text(`DCRAMERE Journal · ${URL_TEXT}`, left, y, { width: width / 2, lineBreak: false });
    doc.text(w.page(i, range.count - 1), left + width / 2, y, { width: width / 2, align: "right", lineBreak: false });
  }
  doc.end();
  return new Promise((resolve) => doc.on("end", () => resolve(file)));
}

const jobs = [
  { lang: "nl", admin: false, file: "public/guide/dcramere-journal-handleiding-nl.pdf" },
  { lang: "en", admin: false, file: "public/guide/dcramere-journal-user-guide-en.pdf" },
  { lang: "nl", admin: true, file: "docs/dcramere-journal-handleiding-coach-nl.pdf" },
  { lang: "en", admin: true, file: "docs/dcramere-journal-coach-guide-en.pdf" },
];

for (const job of jobs) {
  await build(job);
  console.log(`[guide] ${job.file}`);
}
