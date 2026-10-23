// Indeling van een dashboard: welke widgets zichtbaar zijn en in welke volgorde.
// Pure functies plus opslag per browser (een persoonlijke voorkeur, geen data van de klant).
// Elk tabblad (Journal, Stats) heeft een eigen set widgets en een eigen opslagsleutel; zie createLayouts.

export const DEFAULT_NAME = "Default";
export const MAX_NAME = 30;

export function cleanName(name) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

export const emptyState = () => ({ active: DEFAULT_NAME, saved: {} });

export function createLayouts(storageKey, ids) {
  const defaultOrder = [...ids];

  // Alleen bekende id's, zonder dubbelen. Onbekende (bijv. uit een nieuwere versie) vallen weg.
  function cleanOrder(order) {
    if (!Array.isArray(order)) return [...defaultOrder];
    const seen = new Set();
    const out = [];
    for (const id of order) {
      if (ids.includes(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }

  // Normaliseert wat uit de opslag komt, zodat een kapot of verouderd bestand nooit de pagina breekt.
  function normalize(raw) {
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

  return {
    ids,
    defaultOrder,
    cleanOrder,
    normalize,
    hiddenOf: (order) => ids.filter((id) => !order.includes(id)),
    moveWidget(order, id, dir) {
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return order;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    },
    hideWidget: (order, id) => order.filter((x) => x !== id),
    addWidget: (order, id) => (ids.includes(id) && !order.includes(id) ? [...order, id] : order),
    orderFor: (state) => (state.active === DEFAULT_NAME ? [...defaultOrder] : [...(state.saved[state.active] || defaultOrder)]),
    saveAs(state, name, order) {
      const n = cleanName(name);
      if (!n || n === DEFAULT_NAME) return state;
      return { active: n, saved: { ...state.saved, [n]: cleanOrder(order) } };
    },
    removeLayout(state, name) {
      if (!state.saved[name]) return state;
      const saved = { ...state.saved };
      delete saved[name];
      return { active: state.active === name ? DEFAULT_NAME : state.active, saved };
    },
    load() {
      try {
        return normalize(JSON.parse(window.localStorage.getItem(storageKey) || "null"));
      } catch {
        return emptyState();
      }
    },
    persist(state) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // Opslag kan geblokkeerd zijn (privévenster); de indeling werkt dan alleen tijdens dit bezoek.
      }
    },
  };
}

export const JOURNAL_LAYOUTS = createLayouts("dcramere-journal-layouts-v1", [
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
]);

export const STATS_LAYOUTS = createLayouts("dcramere-journal-stats-layouts-v1", [
  "year",
  "cumulative",
  "balance",
  "drawdown",
  "streaks",
  "figures",
  "byWeekday",
  "byHour",
  "byContract",
  "bySide",
  "byMood",
  "bySetup",
  "newsDays",
  "target",
  "growth",
  "monteCarlo",
  "ruin",
  "kelly",
]);
