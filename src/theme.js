export const COLORS = {
  bg: "#0A0A0A",
  card: "#141210",
  cardHi: "#1A1610",
  cardBorder: "#2A241A",
  grid: "#221D14",
  gold: "#D4AF37",
  goldMuted: "#B8912F",
  goldSoft: "rgba(212,175,55,0.14)",
  text: "#F1ECDD",
  textMuted: "#8C8577",
  green: "#4C9A5B",
  greenSoft: "rgba(76,154,91,0.16)",
  red: "#B8514F",
  redSoft: "rgba(184,81,79,0.16)",
  inputBg: "#1B1712",
};

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const SETUPS = [
  "Snelweg (200)",
  "Invoegstrook (CLD Cross)",
  "Rijstrook (STRAP)",
  "Vangrail (DC)",
  "Verkeerslicht (Confluence)",
  "Afrit / Structuurbreuk",
  "Anders",
];

export const MOODS = [
  "Rustig",
  "Zelfverzekerd",
  "Onzeker",
  "Ongeduldig",
  "Gefrustreerd",
  "Wraakzuchtig",
];

export const PERIODS = [
  { value: "all", label: "Alle tijd" },
  { value: "7d", label: "Laatste 7 dagen" },
  { value: "30d", label: "Laatste 30 dagen" },
  { value: "month", label: "Deze maand" },
  { value: "lastMonth", label: "Vorige maand" },
  { value: "year", label: "Dit jaar" },
];

export function toneColor(value) {
  if (value == null || Math.abs(value) < 1e-9) return COLORS.text;
  return value > 0 ? COLORS.green : COLORS.red;
}
