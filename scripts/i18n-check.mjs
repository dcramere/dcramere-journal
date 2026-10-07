// Controleert dat elke tr("Nederlandse tekst") in de code een Engelse vertaling heeft.  npm run i18n:check
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EN } from "../src/i18n-en.js";

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(name) && !name.startsWith("i18n")) files.push(p);
  }
};
walk("src");

const lit = /"((?:[^"\\]|\\.)*)"/g;
const keys = new Map();
const add = (k, f) => {
  const key = k.replace(/\\"/g, '"');
  if (/[A-Za-zÀ-ÿ]{2,}/.test(key)) keys.set(key, f);
};

function firstArg(s, start) {
  let depth = 1;
  let str = null;
  let i = start;
  for (; i < s.length && depth > 0; i += 1) {
    const c = s[i];
    if (str) {
      if (c === "\\") i += 1;
      else if (c === str) str = null;
    } else if (c === '"' || c === "'" || c === "`") str = c;
    else if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (c === "," && depth === 1) return s.slice(start, i);
  }
  return s.slice(start, i - 1);
}

for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/(?<![A-Za-z0-9_.])tr\(/g)) {
    for (const l of firstArg(s, m.index + m[0].length).matchAll(lit)) add(l[1], f);
  }
  for (const m of s.matchAll(/\bk=(?:"((?:[^"\\]|\\.)*)"|\{([^}]*)\})/g)) {
    if (m[1]) add(m[1], f);
    else for (const l of m[2].matchAll(lit)) add(l[1], f);
  }
  for (const m of s.matchAll(/(?<![A-Za-z0-9_.])T\(("(?:[^"\\]|\\.)*")\)/g)) add(m[1].slice(1, -1), f);
  for (const m of s.matchAll(/\bBlock title="((?:[^"\\]|\\.)*)"/g)) add(m[1], f);
  for (const m of s.matchAll(/\b(?:label|title|sub): "((?:[^"\\]|\\.)*)"/g)) add(m[1], f);
}

const missing = [...keys].filter(([k]) => !(k in EN));
const unused = Object.keys(EN).filter((k) => !keys.has(k));
console.log(`${keys.size} vertaalbare teksten, ${Object.keys(EN).length} Engelse vertalingen.`);
if (unused.length) console.log(`(${unused.length} ongebruikte vertalingen — onschadelijk)`);
if (missing.length) {
  console.log(`\n${missing.length} ZONDER Engelse vertaling:`);
  for (const [k, f] of missing) console.log(`  ${f}: ${JSON.stringify(k)}`);
  process.exit(1);
}
console.log("Alles vertaald.");
