import { num } from "./db.js";

export function mapAccount(r) {
  return {
    id: r.id,
    name: r.name,
    broker: r.broker,
    type: r.type,
    startBalance: num(r.start_balance),
    riskMode: r.risk_mode,
    riskUnit: r.risk_unit,
    riskValue: num(r.risk_value),
    commission: num(r.commission),
    adjustments: r.adjustments || [],
  };
}

export function mapTrade(r) {
  return {
    id: r.id,
    accountId: r.account_id,
    symbol: r.symbol,
    direction: r.direction,
    qty: num(r.qty),
    entryPrice: num(r.entry_price),
    exitPrice: num(r.exit_price),
    openedAt: num(r.opened_at),
    closedAt: num(r.closed_at),
    pnl: num(r.pnl),
    fees: num(r.fees),
    r: num(r.r),
    setup: r.setup,
    mood: r.mood,
    lesson: r.lesson,
    hasScreenshot: r.has_screenshot,
    source: r.source,
    fills: num(r.fills) ?? undefined,
    positionSize: r.position_size || "",
  };
}

export async function loadJournal(query, userId) {
  const [accounts, trades, settings] = await Promise.all([
    query(`SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at, id`, [userId]),
    query(`SELECT * FROM trades WHERE user_id = $1 ORDER BY closed_at, id`, [userId]),
    query(`SELECT settings FROM user_settings WHERE user_id = $1`, [userId]),
  ]);
  return {
    accounts: accounts.map(mapAccount),
    trades: trades.map(mapTrade),
    settings: settings[0]?.settings || {},
  };
}
