import { ZodError } from "zod";
import { isConfigured } from "./db.js";
import { ApiError, assertSameOrigin, readJson, send } from "./http.js";
import { requireAdmin, requireUser } from "./auth.js";
import * as authRoutes from "./routes/auth.js";
import * as dataRoutes from "./routes/data.js";
import * as adminRoutes from "./routes/admin.js";

const routes = [];
function add(method, pattern, auth, handler) {
  const keys = [];
  const re = new RegExp(
    `^${pattern.replace(/:([a-zA-Z]+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    })}$`
  );
  routes.push({ method, re, keys, auth, handler });
}

add("GET", "/api/health", "none", authRoutes.health);
add("POST", "/api/auth/register", "none", authRoutes.register);
add("POST", "/api/auth/login", "none", authRoutes.login);
add("POST", "/api/auth/logout", "none", authRoutes.logout);
add("POST", "/api/auth/forgot", "none", authRoutes.forgot);
add("POST", "/api/auth/reset", "none", authRoutes.resetPassword);
add("GET", "/api/auth/me", "user", authRoutes.me);

add("GET", "/api/data", "user", dataRoutes.getData);
add("PUT", "/api/settings", "user", dataRoutes.putSettings);
add("PUT", "/api/accounts/:id", "user", dataRoutes.putAccount);
add("DELETE", "/api/accounts/:id", "user", dataRoutes.deleteAccount);
add("POST", "/api/trades/bulk", "user", dataRoutes.bulkTrades);
add("PUT", "/api/trades/:id", "user", dataRoutes.putTrade);
add("DELETE", "/api/trades/:id", "user", dataRoutes.deleteTrade);
add("GET", "/api/screenshots/:id", "user", dataRoutes.getScreenshot);
add("PUT", "/api/screenshots/:id", "user", dataRoutes.putScreenshot);
add("DELETE", "/api/screenshots/:id", "user", dataRoutes.deleteScreenshot);
add("POST", "/api/import", "user", dataRoutes.importData);
add("GET", "/api/me/export", "user", dataRoutes.exportData);
add("GET", "/api/me/access-log", "user", dataRoutes.accessLog);
add("DELETE", "/api/me/data", "user", dataRoutes.deleteMyData);
add("DELETE", "/api/me", "user", dataRoutes.deleteMe);

add("GET", "/api/admin/users", "admin", adminRoutes.listUsers);
add("GET", "/api/admin/users/:id/data", "admin", adminRoutes.getUserData);
add("GET", "/api/admin/users/:id/screenshots/:tradeId", "admin", adminRoutes.getUserScreenshot);
add("PATCH", "/api/admin/users/:id", "admin", adminRoutes.setUserStatus);

function match(method, path) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(path);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export async function handle(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api/health" && !isConfigured()) {
      return send(res, 200, { ok: true, configured: false, ready: false, needsSetup: false });
    }
    assertSameOrigin(req);
    if (!isConfigured()) throw new ApiError(503, "not_configured");

    const found = match(req.method, path);
    if (!found) throw new ApiError(404, "not_found");

    const ctx = { req, res, url, params: found.params, query: Object.fromEntries(url.searchParams) };
    if (found.route.auth === "user") ctx.user = await requireUser(req);
    if (found.route.auth === "admin") ctx.user = await requireAdmin(req);
    if (["POST", "PUT", "PATCH"].includes(req.method)) ctx.body = await readJson(req);

    const result = await found.route.handler(ctx);
    if (res.writableEnded) return undefined;
    return Array.isArray(result) ? send(res, result[0], result[1]) : send(res, 200, result ?? { ok: true });
  } catch (err) {
    if (err instanceof ApiError) return send(res, err.status, { error: { code: err.code } });
    if (err instanceof ZodError) {
      return send(res, 400, {
        error: { code: "invalid_input", issues: err.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) },
      });
    }
    console.error("API error", err);
    return send(res, 500, { error: { code: "server_error" } });
  }
}
