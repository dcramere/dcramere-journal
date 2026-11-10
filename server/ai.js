// Uitgebreide uitleg bij een rapport, geschreven door Claude.
//
// Privacy: de AI krijgt alleen cijfers en patronen van het rapport. Geen naam, geen e-mailadres, geen notities of lessen,
// geen schermafbeeldingen en alleen emoties en setups uit de vaste lijsten. De uitleg wordt alleen op verzoek gemaakt,
// één keer per rapport en taal bewaard, en verdwijnt met de klant (ON DELETE CASCADE).
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { z } from "zod";
import { MOODS, SETUPS } from "../src/theme.js";
import { computeStats } from "../src/lib/metrics.js";
import { DEFAULT_TZ, enrich } from "../src/lib/model.js";
import { rootSymbol } from "../src/lib/contracts.js";
import { ApiError } from "./http.js";
import { rateLimit } from "./auth.js";
import { query } from "./db.js";
import { loadJournal } from "./mappers.js";

const DEFAULT_MODEL = "claude-opus-5-5";
const DAY = 24 * 60 * 60 * 1000;

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY) || Boolean(clientOverride);
const model = () => process.env.AI_MODEL || DEFAULT_MODEL;
const monthlyLimit = (role) => (role === "admin" ? 100 : Number(process.env.AI_MONTHLY_LIMIT) || 20);

// Voor tests en de lokale ontwikkelserver: een nepclient in plaats van de echte API.
let clientOverride = null;
export function setAiClient(client) {
  clientOverride = client;
}
const getClient = () => clientOverride || new Anthropic({ timeout: 55_000, maxRetries: 1 });

// ---------- Invoer: alleen cijfers ----------

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const minutes = (ms) => (ms == null ? null : round(ms / 60000, 1));

// Emoties en setups komen uit vaste lijsten; alles wat daar niet in staat, wordt een algemeen label.
const mood = (k) => (MOODS.includes(k) ? k : "other");
const setup = (k) => (SETUPS.includes(k) ? k : "other");

function cleanInsight(i) {
  const p = { ...(i.p || {}) };
  if ("mood" in p) p.mood = mood(p.mood);
  if ("setup" in p) p.setup = setup(p.setup);
  return { id: i.id, ...(Object.keys(p).length ? { details: p } : {}), ...(i.tone ? { tone: i.tone } : {}) };
}

// Groepen met minstens 2 trades: winstpercentage en resultaat in dollars, plus het gemiddelde in R als het geplande risico bekend is.
function groups(usdRows, rRows, label) {
  const r = new Map(rRows.map((x) => [x.key, x]));
  return usdRows
    .filter((x) => x.trades >= 2)
    .map((x) => ({ label: label(x.key), trades: x.trades, winRate: round(x.winRate, 3), netUsd: round(x.net, 0), avgR: round(r.get(x.key)?.expectancy ?? null, 2) }));
}

// Alles wat de AI van een rapport te zien krijgt.
export function buildAiFacts({ data, trades, accounts, tz }) {
  const all = enrich(trades, accounts, tz);
  const cur = all.filter((t) => t.day >= data.start && t.day <= data.end);
  const startBalance = accounts.reduce((s, a) => s + (Number(a.startBalance) || 0), 0);
  const s = computeStats(cur, "$", { startBalance });
  const sr = computeStats(cur, "R", {});
  const withMood = cur.filter((t) => t.mood).length;
  return {
    report: { kind: data.kind, from: data.start, to: data.end },
    figures: {
      trades: data.kpis.trades,
      wins: data.kpis.wins,
      losses: data.kpis.losses,
      netUsd: round(data.kpis.net, 0),
      netR: round(data.kpis.netR, 2),
      winRate: round(data.kpis.winRate, 3),
      neededWinRate: round(data.kpis.neededWinRate, 3),
      avgWinUsd: round(data.kpis.avgWin, 0),
      avgLossUsd: round(data.kpis.avgLoss, 0),
      payoffRatio: round(data.kpis.ratio, 2),
      profitFactor: round(data.kpis.profitFactor, 2),
      expectancyUsd: round(data.kpis.expectancy, 1),
      tradingDays: data.kpis.tradingDays,
      greenDays: data.kpis.greenDays,
      redDays: data.kpis.redDays,
      bestDayUsd: data.kpis.bestDay ? round(data.kpis.bestDay.value, 0) : null,
      worstDayUsd: data.kpis.worstDay ? round(data.kpis.worstDay.value, 0) : null,
      maxDrawdownUsd: round(data.kpis.maxDrawdown, 0),
      longestWinStreak: s.streaks.longestWin,
      longestLossStreak: s.streaks.longestLoss,
      tradesPerDay: round(s.tradesPerDay, 1),
      avgContractsPerTrade: round(s.contractsPerTrade, 1),
      avgHoldMinutesWinners: minutes(s.avgHoldWin),
      avgHoldMinutesLosers: minutes(s.avgHoldLoss),
      moodLoggedShare: cur.length ? round(withMood / cur.length, 2) : null,
    },
    previousPeriod: data.prev
      ? { trades: data.prev.trades, netUsd: round(data.prev.net, 0), winRate: round(data.prev.winRate, 3), profitFactor: round(data.prev.profitFactor, 2) }
      : null,
    patterns: {
      byWeekday: groups(s.byWeekday, sr.byWeekday, (k) => WEEKDAYS[k] || String(k)),
      byOpeningHour: groups(s.byHour, sr.byHour, (k) => `${k}:00`),
      byEmotion: groups(s.byMood, sr.byMood, mood),
      bySetup: groups(s.bySetup, sr.bySetup, setup),
      byMarket: groups(s.byContract, sr.byContract, (k) => rootSymbol(k)),
    },
    findings: {
      headline: data.headline ? cleanInsight(data.headline) : null,
      strengths: (data.good || []).map(cleanInsight),
      weaknesses: (data.improve || []).map(cleanInsight),
      notes: (data.neutral || []).map(cleanInsight),
      habit: data.habit ? cleanInsight(data.habit) : null,
      suggestedFocus: data.focus ? cleanInsight(data.focus) : null,
    },
    notes: "avgR and netR are results in R multiples of the planned risk per trade. Groups with fewer than 2 trades are left out.",
  };
}

// ---------- Prompt en uitvoer ----------

const SYSTEM = `You write the detailed explanation that goes with a periodic report from a trading journal. The reader is a retail trader of futures or CFDs who is working with a coach. You receive the computed figures of one week or month as JSON. Nothing else is known about the trader.

Rules:
- Use only the numbers in the JSON. Never invent figures, trades, reasons or market events. If something is not in the data, do not claim it.
- Explain, do not just repeat: say what each number means and why it matters, for example how the payoff ratio relates to the win rate that is needed to break even, or what a drawdown costs in recovery. Connect figures to each other.
- Small samples: with fewer than 10 trades, or groups of fewer than 5 trades, say plainly that the picture is thin and that conclusions are tentative.
- Emotions and habits: describe patterns factually and without judgement. Never diagnose a person.
- No financial advice. Never tell the trader what to buy or sell, to trade bigger, to add risk, or what the market will do. No promises about results. Suggestions are about process and behaviour (rules, logging, pausing, size consistency).
- The plan contains exactly three concrete exercises for the next period, each measurable (a number, a limit or a yes/no) and tied to a finding in the data.
- Tone: direct, warm and practical, like a good coach. Plain words, short sentences, no hype, no emoji.
- Length: summary of 3 to 4 sentences; every other item 2 to 4 sentences. At most 3 strengths, 3 leaks and 3 patterns; leave a list empty when the data does not support an item.
- "caution" is one or two sentences about what this report cannot tell, including the sample size.
- Write everything in the requested language. Address the trader informally ("je" in Dutch, "you" in English). Use dollar signs for money and R for multiples of planned risk. Call the numbers "this week" or "this month" according to the report kind.`;

const ITEM = { type: "object", additionalProperties: false, required: ["title", "detail"], properties: { title: { type: "string" }, detail: { type: "string" } } };
const STEP = { type: "object", additionalProperties: false, required: ["action", "why"], properties: { action: { type: "string" }, why: { type: "string" } } };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strengths", "leaks", "patterns", "plan", "caution"],
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: ITEM },
    leaks: { type: "array", items: ITEM },
    patterns: { type: "array", items: ITEM },
    plan: { type: "array", items: STEP },
    caution: { type: "string" },
  },
};

const item = z.object({ title: z.string().min(1), detail: z.string().min(1) });
const Explanation = z.object({
  summary: z.string().min(1),
  strengths: z.array(item).max(3),
  leaks: z.array(item).max(3),
  patterns: z.array(item).max(3),
  plan: z.array(z.object({ action: z.string().min(1), why: z.string().min(1) })).min(1).max(3),
  caution: z.string().min(1),
});

function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof Anthropic.RateLimitError || err?.status === 529) return new ApiError(503, "ai_busy");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("AI: de API-sleutel is ongeldig of heeft geen toegang:", err.message);
    return new ApiError(503, "ai_not_configured");
  }
  if (err instanceof Anthropic.APIConnectionError) return new ApiError(503, "ai_busy");
  console.error("AI request failed:", err?.status || "", err?.message || err);
  return new ApiError(502, "ai_failed");
}

// Vraagt Claude om de uitleg. Geeft het gevalideerde object terug.
export async function explainReport(facts, lang) {
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: model(),
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Language: ${lang === "en" ? "English" : "Dutch"}\n\n${JSON.stringify(facts)}` }],
    });
  } catch (err) {
    throw toApiError(err);
  }
  if (response.stop_reason === "refusal") throw new ApiError(502, "ai_refused");
  if (response.stop_reason === "max_tokens") throw new ApiError(502, "ai_failed");
  const block = response.content.find((b) => b.type === "text");
  let parsed;
  try {
    parsed = Explanation.parse(JSON.parse(block?.text || ""));
  } catch {
    console.error("AI: onbruikbaar antwoord", String(block?.text || "").slice(0, 200));
    throw new ApiError(502, "ai_failed");
  }
  return parsed;
}

// ---------- Opslag en routes ----------

export const hashOf = (data) => createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);

const langSchema = z.object({ lang: z.enum(["nl", "en"]) });

// Maakt (of vernieuwt) de uitleg voor één rapport van `ownerId`. `actor` is wie op de knop drukte: de klant zelf of de beheerder.
export async function generateAi({ actor, ownerId, reportId, body }) {
  if (!aiConfigured()) throw new ApiError(503, "ai_not_configured");
  const { lang } = langSchema.parse(body);
  const [row] = await query(`SELECT id, kind, period_key, data FROM reports WHERE id = $1::uuid AND user_id = $2::uuid`, [reportId, ownerId]);
  if (!row) throw new ApiError(404, "not_found");

  // Kostenbeheersing: een korte rem tegen dubbelklikken en een maandlimiet per persoon die op de knop drukt.
  await rateLimit(`ai-burst:${actor.id}`, 3, 10 * 60 * 1000);
  await rateLimit(`ai-month:${actor.id}`, monthlyLimit(actor.role), 30 * DAY);

  const { accounts, trades, settings } = await loadJournal(query, ownerId);
  const facts = buildAiFacts({ data: row.data, trades, accounts, tz: settings.timezone || DEFAULT_TZ });
  const content = await explainReport(facts, lang);
  const createdAt = Date.now();
  const inputHash = hashOf(row.data);
  await query(
    `INSERT INTO report_ai (user_id, kind, period_key, lang, content, input_hash, model, created_at)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8::bigint)
     ON CONFLICT (user_id, kind, period_key, lang) DO UPDATE
       SET content = EXCLUDED.content, input_hash = EXCLUDED.input_hash, model = EXCLUDED.model, created_at = EXCLUDED.created_at`,
    [ownerId, row.kind, row.period_key, lang, JSON.stringify(content), inputHash, model(), createdAt]
  );
  return { reportId, lang, ai: { content, stale: false, createdAt, model: model() } };
}

// Bewaarde uitleg per rapport, voor in de lijst met rapporten: { "week:2026-W44": { nl: {...}, en: {...} } }.
export async function loadAiFor(userId, reports) {
  const rows = await query(`SELECT kind, period_key, lang, content, input_hash, model, created_at FROM report_ai WHERE user_id = $1::uuid`, [userId]);
  const byKey = new Map(reports.map((r) => [`${r.kind}:${r.periodKey}`, hashOf(r.data)]));
  const out = {};
  for (const r of rows) {
    const key = `${r.kind}:${r.period_key}`;
    if (!byKey.has(key)) continue;
    (out[key] ||= {})[r.lang] = { content: r.content, stale: r.input_hash !== byKey.get(key), createdAt: Number(r.created_at), model: r.model };
  }
  return out;
}

export async function deleteAiFor(userId) {
  await query(`DELETE FROM report_ai WHERE user_id = $1::uuid`, [userId]);
}
