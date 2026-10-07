import { config } from "../config.js";
import { query } from "../db.js";
import { ApiError, clientIp } from "../http.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  dummyVerify,
  hashPassword,
  ipKey,
  publicUser,
  rateLimit,
  safeEqual,
  verifyPassword,
} from "../auth.js";
import { upsertSettings } from "../data-ops.js";
import { loginSchema, registerSchema } from "../validators.js";

const MIN15 = 15 * 60 * 1000;

export async function register({ req, res, body }) {
  const input = registerSchema.parse(body);
  await rateLimit(ipKey("register", req), 5, 60 * 60 * 1000);
  const email = input.email.toLowerCase();

  let role = "client";
  if (input.setupToken) {
    if (!config.setupToken || !safeEqual(input.setupToken, config.setupToken)) throw new ApiError(403, "bad_setup_token");
    const admins = await query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
    if (admins.length) throw new ApiError(403, "setup_closed");
    role = "admin";
  } else if (input.consent !== true) {
    throw new ApiError(400, "consent_required");
  }

  const hash = await hashPassword(input.password);
  const now = Date.now();
  let user;
  try {
    [user] = await query(
      `INSERT INTO users (email, name, password_hash, role, consent_at, created_at, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $5, $5) RETURNING *`,
      [email, input.name, hash, role, now]
    );
  } catch (e) {
    if (e && e.code === "23505") throw new ApiError(409, "email_taken");
    throw e;
  }
  if (input.lang) await upsertSettings(user.id, { lang: input.lang });
  await createSession(req, res, user.id);
  return [201, { user: publicUser(user) }];
}

export async function login({ req, res, body }) {
  const input = loginSchema.parse(body);
  const email = input.email.toLowerCase();
  await rateLimit(ipKey("login", req), 20, MIN15);
  await rateLimit(`login:email:${email}`, 8, MIN15);

  const [user] = await query(`SELECT * FROM users WHERE email = $1`, [email]);
  if (!user) {
    await dummyVerify(input.password);
    throw new ApiError(401, "invalid_credentials");
  }
  if (!(await verifyPassword(input.password, user.password_hash))) throw new ApiError(401, "invalid_credentials");
  if (user.status !== "active") throw new ApiError(403, "account_disabled");

  await query(`UPDATE users SET last_login_at = $2 WHERE id = $1::uuid`, [user.id, Date.now()]);
  await createSession(req, res, user.id);
  return { user: publicUser(user) };
}

export async function logout({ req, res }) {
  await destroySession(req);
  clearSessionCookie(req, res);
  return { ok: true };
}

export async function me({ user }) {
  return { user: publicUser(user) };
}

export async function health() {
  const base = { ok: true, configured: true };
  try {
    const admins = await query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
    return { ...base, ready: true, needsSetup: admins.length === 0 && Boolean(config.setupToken) };
  } catch {
    return { ...base, ready: false, needsSetup: false };
  }
}

export const ipForLog = clientIp;
