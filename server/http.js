import { config } from "./config.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body === undefined ? "" : JSON.stringify(body));
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const isSecure = (req) => req.headers["x-forwarded-proto"] === "https" || process.env.VERCEL === "1";

export function sessionCookie(req, token, maxAgeSeconds) {
  const parts = [`${config.cookieName}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (isSecure(req)) parts.push("Secure");
  return parts.join("; ");
}

export function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.headers["x-real-ip"] || "") || req.socket?.remoteAddress || "unknown";
}

export async function readJson(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = "";
  if (typeof req.body === "string") raw = req.body;
  else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > config.maxBodyBytes) throw new ApiError(413, "payload_too_large");
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}

// Schrijvende verzoeken moeten van onze eigen pagina komen (CSRF-bescherming):
// een eigen header (die cross-site een preflight vereist) en een kloppende Origin.
export function assertSameOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers["x-dj-csrf"] !== "1") throw new ApiError(403, "csrf");
  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      throw new ApiError(403, "csrf");
    }
    const own = req.headers["x-forwarded-host"] || req.headers.host;
    if (host !== own) throw new ApiError(403, "csrf");
  }
}

// Werk dat na het antwoord mag doorlopen (e-mail versturen). Zo is de responstijd gelijk,
// ongeacht of een e-mailadres bestaat. Op Vercel houdt waitUntil de functie in leven.
const pending = new Set();
export function defer(fn) {
  const p = Promise.resolve()
    .then(fn)
    .catch((err) => console.error("deferred task failed:", err?.message || err))
    .finally(() => pending.delete(p));
  pending.add(p);
  import("@vercel/functions")
    .then((m) => m.waitUntil(p))
    .catch(() => {});
}

// Voor tests: wacht tot alle uitgestelde taken klaar zijn.
export async function flushDeferred() {
  while (pending.size) await Promise.all([...pending]);
}
