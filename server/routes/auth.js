import { config } from "../config.js";
import { query } from "../db.js";
import { ApiError, clientIp, defer } from "../http.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  dummyVerify,
  hashPassword,
  ipKey,
  issueResetToken,
  publicUser,
  rateLimit,
  safeEqual,
  sha256,
  verifyPassword,
} from "../auth.js";
import { appUrl, isMailConfigured, passwordChangedEmail, resetEmail, sendMail } from "../mailer.js";
import { upsertSettings } from "../data-ops.js";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "../validators.js";

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
  const base = { ok: true, configured: true, mail: isMailConfigured() };
  try {
    const admins = await query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
    return { ...base, ready: true, needsSetup: admins.length === 0 && Boolean(config.setupToken) };
  } catch {
    return { ...base, ready: false, needsSetup: false };
  }
}

const HOUR = 60 * 60 * 1000;
const RESET_TTL = HOUR;

// Wachtwoord vergeten: antwoordt altijd hetzelfde, ook als het e-mailadres onbekend is.
export async function forgot({ req, body }) {
  const { email: raw } = forgotSchema.parse(body);
  if (!isMailConfigured()) throw new ApiError(503, "mail_not_configured");
  await rateLimit(ipKey("forgot", req), 8, HOUR);
  const email = raw.toLowerCase();
  const done = { ok: true };
  try {
    await rateLimit(`forgot:email:${email}`, 3, HOUR);
  } catch {
    return done; // Geen 429: dat zou verraden dat het adres bekend is.
  }

  const [user] = await query(
    `SELECT u.id, u.name, u.status, s.settings->>'lang' AS lang
     FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.email = $1`,
    [email]
  );
  if (user && user.status === "active") {
    // Token maken en mailen gebeurt na het antwoord, zodat de responstijd niets verraadt.
    defer(async () => {
      const base = appUrl();
      if (!base) throw new Error("APP_URL ontbreekt: kan geen resetlink maken");
      const { token } = await issueResetToken(user.id, RESET_TTL);
      await sendMail({ to: email, ...resetEmail({ lang: user.lang, name: user.name, link: `${base}/#/reset?token=${token}` }) });
    });
  }
  return done;
}

export async function resetPassword({ req, body }) {
  const { token, password } = resetSchema.parse(body);
  await rateLimit(ipKey("reset", req), 10, 15 * 60 * 1000);
  const now = Date.now();
  const [row] = await query(
    `SELECT r.id, r.user_id, u.email, u.name, u.status, s.settings->>'lang' AS lang
     FROM password_resets r JOIN users u ON u.id = r.user_id LEFT JOIN user_settings s ON s.user_id = u.id
     WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > $2`,
    [sha256(token), now]
  );
  if (!row || row.status !== "active") throw new ApiError(400, "invalid_token");
  // Eén keer te gebruiken: de eerste die het token opmaakt wint.
  const claimed = await query(`UPDATE password_resets SET used_at = $2 WHERE id = $1::uuid AND used_at IS NULL RETURNING id`, [row.id, now]);
  if (!claimed.length) throw new ApiError(400, "invalid_token");

  const hash = await hashPassword(password);
  await query(`UPDATE users SET password_hash = $2 WHERE id = $1::uuid`, [row.user_id, hash]);
  await query(`DELETE FROM sessions WHERE user_id = $1::uuid`, [row.user_id]);
  await query(`UPDATE password_resets SET used_at = $2 WHERE user_id = $1::uuid AND used_at IS NULL`, [row.user_id, now]);
  await query(`DELETE FROM rate_limits WHERE key = $1`, [`login:email:${row.email}`]);
  defer(() => sendMail({ to: row.email, ...passwordChangedEmail({ lang: row.lang, name: row.name }) }));
  return { ok: true };
}

export const ipForLog = clientIp;
