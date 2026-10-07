import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";
import { query } from "./db.js";
import { ApiError, clientIp, parseCookies, sessionCookie } from "./http.js";

const scryptAsync = promisify(scrypt);
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Vaste hash om de rekentijd gelijk te houden als een e-mailadres niet bestaat.
let dummy = null;
export async function dummyVerify(password) {
  dummy = dummy || (await hashPassword("dummy-password-for-timing"));
  await verifyPassword(password, dummy);
}

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export async function createSession(req, res, userId) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const maxAge = config.sessionDays * 86400;
  await query(`INSERT INTO sessions (user_id, token_hash, user_agent, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)`, [
    userId,
    sha256(token),
    String(req.headers["user-agent"] || "").slice(0, 200),
    now,
    now + maxAge * 1000,
  ]);
  res.setHeader("Set-Cookie", sessionCookie(req, token, maxAge));
}

export function clearSessionCookie(req, res) {
  res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
}

export async function destroySession(req) {
  const token = parseCookies(req)[config.cookieName];
  if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
}

export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: Number(row.created_at),
    lastLoginAt: row.last_login_at == null ? null : Number(row.last_login_at),
  };
}

export async function getUser(req) {
  const token = parseCookies(req)[config.cookieName];
  if (!token) return null;
  const rows = await query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2 AND u.status = 'active'`,
    [sha256(token), Date.now()]
  );
  return rows[0] || null;
}

export async function requireUser(req) {
  const user = await getUser(req);
  if (!user) throw new ApiError(401, "unauthorized");
  return user;
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.role !== "admin") throw new ApiError(403, "forbidden");
  return user;
}

// Teller per venster; gooit 429 als de limiet is bereikt.
export async function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const rows = await query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key) DO UPDATE SET
       window_start = CASE WHEN rate_limits.window_start < $3 THEN $2 ELSE rate_limits.window_start END,
       count = CASE WHEN rate_limits.window_start < $3 THEN 1 ELSE rate_limits.count + 1 END
     RETURNING count`,
    [key, now, now - windowMs]
  );
  if (Number(rows[0].count) > limit) throw new ApiError(429, "rate_limited");
}

export const ipKey = (action, req) => `${action}:ip:${clientIp(req)}`;
