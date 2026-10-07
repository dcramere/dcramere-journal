import { query } from "./db.js";
import { ApiError } from "./http.js";

export const MAX_ACCOUNTS = 50;
export const MAX_TRADES = 100000;

const accountRow = (a) => ({
  id: a.id,
  name: a.name,
  broker: a.broker,
  type: a.type,
  start_balance: a.startBalance,
  risk_mode: a.riskMode,
  risk_unit: a.riskUnit,
  risk_value: a.riskValue,
  commission: a.commission,
  adjustments: a.adjustments,
});

const tradeRow = (t) => ({
  id: t.id,
  account_id: t.accountId,
  symbol: t.symbol.toUpperCase(),
  direction: t.direction,
  qty: t.qty,
  entry_price: t.entryPrice ?? null,
  exit_price: t.exitPrice ?? null,
  opened_at: t.openedAt,
  closed_at: Math.max(t.closedAt, t.openedAt),
  pnl: t.pnl,
  fees: t.fees,
  r: t.r ?? null,
  setup: t.setup,
  mood: t.mood,
  lesson: t.lesson,
  has_screenshot: t.hasScreenshot,
  source: t.source,
  fills: t.fills ?? null,
  position_size: t.positionSize,
});

export async function upsertAccounts(userId, accounts) {
  if (!accounts.length) return;
  const [{ n }] = await query(`SELECT count(*) AS n FROM accounts WHERE user_id = $1::uuid AND id <> ALL($2::text[])`, [
    userId,
    accounts.map((a) => a.id),
  ]);
  if (Number(n) + accounts.length > MAX_ACCOUNTS) throw new ApiError(400, "too_many_accounts");
  await query(
    `INSERT INTO accounts (user_id, id, name, broker, type, start_balance, risk_mode, risk_unit, risk_value, commission, adjustments, created_at)
     SELECT $1::uuid, x.id, x.name, x.broker, x.type, x.start_balance, x.risk_mode, x.risk_unit, x.risk_value, x.commission, x.adjustments, $3::bigint
     FROM jsonb_to_recordset($2::jsonb) AS x(id text, name text, broker text, type text, start_balance double precision,
       risk_mode text, risk_unit text, risk_value double precision, commission double precision, adjustments jsonb)
     ON CONFLICT (user_id, id) DO UPDATE SET
       name = EXCLUDED.name, broker = EXCLUDED.broker, type = EXCLUDED.type, start_balance = EXCLUDED.start_balance,
       risk_mode = EXCLUDED.risk_mode, risk_unit = EXCLUDED.risk_unit, risk_value = EXCLUDED.risk_value,
       commission = EXCLUDED.commission, adjustments = EXCLUDED.adjustments`,
    [userId, JSON.stringify(accounts.map(accountRow)), Date.now()]
  );
}

export async function upsertTrades(userId, trades) {
  if (!trades.length) return;
  const [{ n }] = await query(`SELECT count(*) AS n FROM trades WHERE user_id = $1::uuid`, [userId]);
  if (Number(n) + trades.length > MAX_TRADES) throw new ApiError(413, "too_many_trades");
  try {
    await query(
      `INSERT INTO trades (user_id, id, account_id, symbol, direction, qty, entry_price, exit_price, opened_at, closed_at, pnl, fees, r,
         setup, mood, lesson, has_screenshot, source, fills, position_size, created_at, updated_at)
       SELECT $1::uuid, x.id, x.account_id, x.symbol, x.direction, x.qty, x.entry_price, x.exit_price, x.opened_at, x.closed_at, x.pnl, x.fees, x.r,
         x.setup, x.mood, x.lesson, x.has_screenshot, x.source, x.fills, x.position_size, $3::bigint, $3::bigint
       FROM jsonb_to_recordset($2::jsonb) AS x(id text, account_id text, symbol text, direction text, qty double precision,
         entry_price double precision, exit_price double precision, opened_at bigint, closed_at bigint, pnl double precision,
         fees double precision, r double precision, setup text, mood text, lesson text, has_screenshot boolean, source text,
         fills integer, position_size text)
       ON CONFLICT (user_id, id) DO UPDATE SET
         account_id = EXCLUDED.account_id, symbol = EXCLUDED.symbol, direction = EXCLUDED.direction, qty = EXCLUDED.qty,
         entry_price = EXCLUDED.entry_price, exit_price = EXCLUDED.exit_price, opened_at = EXCLUDED.opened_at,
         closed_at = EXCLUDED.closed_at, pnl = EXCLUDED.pnl, fees = EXCLUDED.fees, r = EXCLUDED.r, setup = EXCLUDED.setup,
         mood = EXCLUDED.mood, lesson = EXCLUDED.lesson, has_screenshot = EXCLUDED.has_screenshot, source = EXCLUDED.source,
         fills = EXCLUDED.fills, position_size = EXCLUDED.position_size, updated_at = EXCLUDED.updated_at`,
      [userId, JSON.stringify(trades.map(tradeRow)), Date.now()]
    );
  } catch (e) {
    if (e && e.code === "23503") throw new ApiError(400, "unknown_account");
    throw e;
  }
}

export async function upsertSettings(userId, settings) {
  if (JSON.stringify(settings).length > 30000) throw new ApiError(413, "payload_too_large");
  await query(
    `INSERT INTO user_settings (user_id, settings, updated_at) VALUES ($1::uuid, $2::jsonb, $3::bigint)
     ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at`,
    [userId, JSON.stringify(settings), Date.now()]
  );
}
