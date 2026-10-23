// Indeling van het Journal-dashboard: welke widgets zichtbaar zijn en in welke volgorde.
// Pure functies plus opslag per browser (een persoonlijke voorkeur, geen data van de klant).

export const WIDGET_IDS = [
  "balance",
  "winPct",
  "avgWinLoss",
  "profitFactor",
  "expectancy",
  "avgR",
  "year",
  "calendar",
  "recent",
  "news",
  "mood",
  "winLine",
  "ratioLine",
  "wlLine",
  "expLine",
  "drawdown",
  "size",
  "daily",
  "hold",
  "timeOfDay",
  "cumulative",
];

export const DEFAULT_ORDER = [...WIDGET_IDS];
export const DEFAULT_NAME = "Default";
export const MAX_NAME = 30;
const KEY = "dcramere-journal-layouts-v1";

// Alleen bekende id's, zonder dubbelen. Onbekende (bijv. uit een nieuwere versie) vallen weg.
export function cleanOrder(order) {
  if (!Array.isArray(order)) return [...DEFAULT_ORDER];
  const seen = new Set();
  const out = [];
  for (const id of order) {
    if (WIDGET_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function hiddenOf(order) {
  return WIDGET_IDS.filter((id) => !order.includes(id));
}

export function moveWidget(order, id, dir) {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const hideWidget = (order, id) => order.filter((x) => x !== id);
export const addWidget = (order, id) => (WIDGET_IDS.includes(id) && !order.includes(id) ? [...order, id] : order);

export function cleanName(name) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

export function emptyState() {
  return { active: DEFAULT_NAME, saved: {} };
}

// Normaliseert wat uit de opslag komt, zodat een kapot of verouderd bestand nooit de pagina breekt.
export function normalize(raw) {
  const out = emptyState();
  if (!raw || typeof raw !== "object") return out;
  const saved = raw.saved && typeof raw.saved === "object" ? raw.saved : {};
  for (const [k, v] of Object.entries(saved)) {
    const name = cleanName(k);
    if (name && name !== DEFAULT_NAME) out.saved[name] = cleanOrder(v);
  }
  if (typeof raw.active === "string" && (raw.active === DEFAULT_NAME || out.saved[raw.active])) out.active = raw.active;
  return out;
}

export function orderFor(state) {
  return state.active === DEFAULT_NAME ? [...DEFAULT_ORDER] : [...(state.saved[state.active] || DEFAULT_ORDER)];
}

export function saveAs(state, name, order) {
  const n = cleanName(name);
  if (!n || n === DEFAULT_NAME) return state;
  return { active: n, saved: { ...state.saved, [n]: cleanOrder(order) } };
}

export function removeLayout(state, name) {
  if (!state.saved[name]) return state;
  const saved = { ...state.saved };
  delete saved[name];
  return { active: state.active === name ? DEFAULT_NAME : state.active, saved };
}

export function loadState() {
  try {
    return normalize(JSON.parse(window.localStorage.getItem(KEY) || "null"));
  } catch {
    return emptyState();
  }
}

export function persistState(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Opslag kan geblokkeerd zijn (privévenster); de indeling werkt dan alleen tijdens dit bezoek.
  }
}
