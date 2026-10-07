import { query } from "../db.js";
import { ApiError } from "../http.js";
import { clearSessionCookie, publicUser } from "../auth.js";
import { upsertAccounts, upsertSettings, upsertTrades } from "../data-ops.js";
import { loadJournal } from "../mappers.js";
import { accountSchema, bulkTradesSchema, importSchema, screenshotSchema, settingsSchema, tradeSchema } from "../validators.js";

export async function getData({ user }) {
  return { user: publicUser(user), ...(await loadJournal(query, user.id)) };
}

export async function putSettings({ user, body }) {
  await upsertSettings(user.id, settingsSchema.parse(body));
  return { ok: true };
}

export async function putAccount({ user, params, body }) {
  const account = accountSchema.parse({ ...body, id: params.id });
  await upsertAccounts(user.id, [account]);
  return { ok: true };
}

export async function deleteAccount({ user, params }) {
  await query(`DELETE FROM accounts WHERE user_id = $1::uuid AND id = $2`, [user.id, params.id]);
  return { ok: true };
}

export async function putTrade({ user, params, body }) {
  const trade = tradeSchema.parse({ ...body, id: params.id });
  await upsertTrades(user.id, [trade]);
  return { ok: true };
}

export async function bulkTrades({ user, body }) {
  const { trades } = bulkTradesSchema.parse(body);
  await upsertTrades(user.id, trades);
  return { ok: true, count: trades.length };
}

export async function deleteTrade({ user, params }) {
  await query(`DELETE FROM trades WHERE user_id = $1::uuid AND id = $2`, [user.id, params.id]);
  return { ok: true };
}

export async function getScreenshot({ user, params }) {
  const [row] = await query(`SELECT data FROM screenshots WHERE user_id = $1::uuid AND trade_id = $2`, [user.id, params.id]);
  if (!row) throw new ApiError(404, "not_found");
  return { data: row.data };
}

export async function putScreenshot({ user, params, body }) {
  const { data } = screenshotSchema.parse(body);
  const [trade] = await query(`SELECT 1 FROM trades WHERE user_id = $1::uuid AND id = $2`, [user.id, params.id]);
  if (!trade) throw new ApiError(404, "not_found");
  await query(
    `INSERT INTO screenshots (user_id, trade_id, data) VALUES ($1::uuid, $2, $3)
     ON CONFLICT (user_id, trade_id) DO UPDATE SET data = EXCLUDED.data`,
    [user.id, params.id, data]
  );
  await query(`UPDATE trades SET has_screenshot = true WHERE user_id = $1::uuid AND id = $2`, [user.id, params.id]);
  return { ok: true };
}

export async function deleteScreenshot({ user, params }) {
  await query(`DELETE FROM screenshots WHERE user_id = $1::uuid AND trade_id = $2`, [user.id, params.id]);
  await query(`UPDATE trades SET has_screenshot = false WHERE user_id = $1::uuid AND id = $2`, [user.id, params.id]);
  return { ok: true };
}

// Accounts eerst, daarna trades (ze verwijzen ernaar).
export async function importData({ user, body }) {
  const input = importSchema.parse(body);
  if (input.accounts) await upsertAccounts(user.id, input.accounts);
  if (input.trades) await upsertTrades(user.id, input.trades);
  if (input.settings) await upsertSettings(user.id, input.settings);
  return { ok: true, accounts: input.accounts?.length || 0, trades: input.trades?.length || 0 };
}

export async function exportData({ user }) {
  const journal = await loadJournal(query, user.id);
  const shots = await query(`SELECT trade_id, data FROM screenshots WHERE user_id = $1::uuid`, [user.id]);
  return {
    app: "dcramere-journal",
    version: 2,
    exportedAt: Date.now(),
    ...journal,
    screenshots: Object.fromEntries(shots.map((s) => [s.trade_id, s.data])),
  };
}

export async function deleteMyData({ user }) {
  await query(`DELETE FROM accounts WHERE user_id = $1::uuid`, [user.id]);
  await query(`DELETE FROM user_settings WHERE user_id = $1::uuid`, [user.id]);
  return { ok: true };
}

export async function deleteMe({ req, res, user }) {
  if (user.role === "admin") {
    const [{ n }] = await query(`SELECT count(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1::uuid`, [user.id]);
    if (Number(n) === 0) throw new ApiError(409, "last_admin");
  }
  await query(`DELETE FROM users WHERE id = $1::uuid`, [user.id]);
  clearSessionCookie(req, res);
  return { ok: true };
}

export async function accessLog({ user }) {
  const rows = await query(
    `SELECT a.action, a.created_at, u.name AS actor_name FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.target_user_id = $1::uuid ORDER BY a.created_at DESC LIMIT 50`,
    [user.id]
  );
  return { entries: rows.map((r) => ({ action: r.action, at: Number(r.created_at), actor: r.actor_name || null })) };
}
