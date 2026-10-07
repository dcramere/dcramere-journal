import { query } from "../db.js";
import { ApiError } from "../http.js";
import { issueResetToken, publicUser } from "../auth.js";
import { loadJournal } from "../mappers.js";
import { statusSchema } from "../validators.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86400000;

function targetId(params) {
  if (!UUID.test(params.id)) throw new ApiError(404, "not_found");
  return params.id;
}

// Elke keer dat de beheerder een klantjournal opent, wordt dat vastgelegd
// (maximaal één regel per 10 minuten per klant). Klanten kunnen dit zelf inzien.
async function logAccess(actorId, targetUserId, action) {
  const now = Date.now();
  await query(
    `INSERT INTO audit_log (actor_id, target_user_id, action, created_at)
     SELECT $1::uuid, $2::uuid, $3::text, $4::bigint
     WHERE NOT EXISTS (
       SELECT 1 FROM audit_log WHERE actor_id = $1::uuid AND target_user_id = $2::uuid AND action = $3::text AND created_at > $5::bigint
     )`,
    [actorId, targetUserId, action, now, now - 10 * 60 * 1000]
  );
}

export async function listUsers() {
  const since = Date.now() - 30 * DAY;
  const rows = await query(
    `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at, u.last_login_at,
            COALESCE(a.n, 0) AS accounts,
            COALESCE(t.n, 0) AS trades, COALESCE(t.net, 0) AS net, COALESCE(t.wins, 0) AS wins, COALESCE(t.losses, 0) AS losses,
            COALESCE(t.n30, 0) AS trades30, COALESCE(t.net30, 0) AS net30, t.last_closed
     FROM users u
     LEFT JOIN (SELECT user_id, count(*) AS n FROM accounts GROUP BY user_id) a ON a.user_id = u.id
     LEFT JOIN (
       SELECT user_id, count(*) AS n, sum(pnl) AS net,
              count(*) FILTER (WHERE pnl > 0) AS wins, count(*) FILTER (WHERE pnl < 0) AS losses,
              count(*) FILTER (WHERE closed_at >= $1::bigint) AS n30, sum(pnl) FILTER (WHERE closed_at >= $1::bigint) AS net30,
              max(closed_at) AS last_closed
       FROM trades GROUP BY user_id
     ) t ON t.user_id = u.id
     ORDER BY u.created_at DESC`,
    [since]
  );
  return {
    users: rows.map((r) => ({
      ...publicUser(r),
      accounts: Number(r.accounts),
      trades: Number(r.trades),
      net: Number(r.net),
      wins: Number(r.wins),
      losses: Number(r.losses),
      trades30: Number(r.trades30),
      net30: Number(r.net30),
      lastTradeAt: r.last_closed == null ? null : Number(r.last_closed),
    })),
  };
}

export async function getUserData({ user, params }) {
  const id = targetId(params);
  const [target] = await query(`SELECT * FROM users WHERE id = $1::uuid`, [id]);
  if (!target) throw new ApiError(404, "not_found");
  if (target.id !== user.id) await logAccess(user.id, target.id, "view_journal");
  return { user: publicUser(target), ...(await loadJournal(query, target.id)) };
}

export async function getUserScreenshot({ params }) {
  const id = targetId(params);
  const [row] = await query(`SELECT data FROM screenshots WHERE user_id = $1::uuid AND trade_id = $2`, [id, params.tradeId]);
  if (!row) throw new ApiError(404, "not_found");
  return { data: row.data };
}

// De beheerder maakt een resetlink voor een klant (zonder e-mail). Altijd vastgelegd en zichtbaar voor de klant.
export async function createResetLink({ user, params }) {
  const id = targetId(params);
  if (id === user.id) throw new ApiError(400, "cannot_change_self");
  const [target] = await query(`SELECT role, status FROM users WHERE id = $1::uuid`, [id]);
  if (!target) throw new ApiError(404, "not_found");
  if (target.role === "admin") throw new ApiError(403, "forbidden");
  if (target.status !== "active") throw new ApiError(409, "user_disabled");
  const { token, expiresAt } = await issueResetToken(id, 24 * 60 * 60 * 1000);
  await query(`INSERT INTO audit_log (actor_id, target_user_id, action, created_at) VALUES ($1::uuid, $2::uuid, 'reset_link', $3::bigint)`, [
    user.id,
    id,
    Date.now(),
  ]);
  return { token, expiresAt };
}

export async function setUserStatus({ user, params, body }) {
  const id = targetId(params);
  const { status } = statusSchema.parse(body);
  if (id === user.id) throw new ApiError(400, "cannot_change_self");
  const [target] = await query(`SELECT role FROM users WHERE id = $1::uuid`, [id]);
  if (!target) throw new ApiError(404, "not_found");
  if (target.role === "admin") throw new ApiError(403, "forbidden");
  await query(`UPDATE users SET status = $2 WHERE id = $1::uuid`, [id, status]);
  if (status === "disabled") await query(`DELETE FROM sessions WHERE user_id = $1::uuid`, [id]);
  return { ok: true };
}
