import { EN } from "./i18n-en.js";

// Nederlands is de brontaal: t("Nederlandse tekst") geeft de Engelse vertaling terug
// wanneer de taal op "en" staat. Onbekende teksten vallen terug op het Nederlands.
let lang = "nl";

export function setLang(next) {
  lang = next === "en" ? "en" : "nl";
}

export function getLang() {
  return lang;
}

export function detectLang() {
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("nl") ? "nl" : "en";
}

export function tr(nl, params) {
  let s = lang === "en" && EN[nl] !== undefined ? EN[nl] : nl;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
  return s;
}
