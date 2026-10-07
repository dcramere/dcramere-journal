// End-to-end test van de API tegen een in-memory Postgres (PGlite).  npm run test:api
import { createDevServer } from "./dev-api.mjs";
import { query } from "../server/db.js";
import { flushDeferred } from "../server/http.js";
import { setMailer } from "../server/mailer.js";
import { lastCompletedPeriods } from "../src/lib/report.js";
import { todayInTz, wallToEpoch } from "../src/lib/tz.js";

process.env.ADMIN_SETUP_TOKEN = "test-setup-token";
process.env.APP_URL = "https://journal.test";
const server = await createDevServer({ memory: true });
const mails = [];
const notified = []; // alle "nieuwe klant"-meldingen, ook nadat `mails` is leeggemaakt
setMailer(async (m) => {
  mails.push(m);
  if (/Nieuwe klant|New client/.test(m.subject)) notified.push(m);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${!cond && extra ? "  -> " + extra : ""}`);
};

let ipCounter = 1;
class Client {
  constructor() {
    this.cookie = "";
    this.ip = `10.0.0.${ipCounter++}`;
  }
  async req(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", "X-DJ-CSRF": "1", "X-Forwarded-For": this.ip, ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (path === "/api/auth/register") await flushDeferred(); // meldingen na een registratie zijn dan klaar
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json, set };
  }
}

const account = (id, over = {}) => ({ id, name: "Prop", broker: "Tradovate", type: "PROP", startBalance: 25000, riskMode: "FIXED", riskUnit: "$", riskValue: 100, commission: 1, adjustments: [], ...over });
const trade = (id, accountId, pnl, over = {}) => ({ id, accountId, symbol: "MNQ", direction: "Long", qty: 2, entryPrice: 100, exitPrice: 101, openedAt: Date.now() - 60000, closedAt: Date.now(), pnl, fees: 2, r: null, setup: "Snelweg (200)", mood: "Rustig", lesson: "", hasScreenshot: false, source: "manual", ...over });

// --- health & setup
const anon = new Client();
let r = await anon.req("GET", "/api/health");
ok("health configured+ready, needs setup", r.json.configured && r.json.ready && r.json.needsSetup === true, JSON.stringify(r.json));

// --- csrf
r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
ok("POST without CSRF header is rejected", r.status === 403);
r = await anon.req("POST", "/api/auth/login", { email: "x@y.nl", password: "x" }, { Origin: "https://evil.example" });
ok("cross-origin POST rejected", r.status === 403);

// --- admin bootstrap
const admin = new Client();
r = await admin.req("POST", "/api/auth/register", { email: "dino@example.com", password: "correct horse battery", name: "Dino", setupToken: "wrong" });
ok("wrong setup token rejected", r.status === 403 && r.json.error.code === "bad_setup_token");
r = await admin.req("POST", "/api/auth/register", { email: "dino@example.com", password: "correct horse battery", name: "Dino", setupToken: "test-setup-token" });
ok("admin registers with setup token", r.status === 201 && r.json.user.role === "admin", JSON.stringify(r.json));
ok("session cookie is HttpOnly + SameSite", /HttpOnly/.test(r.set) && /SameSite=Lax/.test(r.set));
r = await new Client().req("POST", "/api/auth/register", { email: "evil@example.com", password: "correct horse battery", name: "Evil", setupToken: "test-setup-token" });
ok("setup closes once an admin exists", r.status === 403 && r.json.error.code === "setup_closed");
r = await anon.req("GET", "/api/health");
ok("health no longer needs setup", r.json.needsSetup === false);

// --- client registration
const alice = new Client();
r = await alice.req("POST", "/api/auth/register", { email: "alice@example.com", password: "short", name: "Alice", consent: true });
ok("short password rejected", r.status === 400 && r.json.error.code === "invalid_input");
r = await alice.req("POST", "/api/auth/register", { email: "alice@example.com", password: "alice-long-password", name: "Alice" });
ok("consent required", r.status === 400 && r.json.error.code === "consent_required");
r = await alice.req("POST", "/api/auth/register", { email: "Alice@Example.com", password: "alice-long-password", name: "Alice", consent: true, lang: "en" });
ok("client registers (email normalised)", r.status === 201 && r.json.user.email === "alice@example.com" && r.json.user.role === "client");
r = await new Client().req("POST", "/api/auth/register", { email: "alice@example.com", password: "another-long-password", name: "Dup", consent: true });
ok("duplicate email rejected", r.status === 409 && r.json.error.code === "email_taken");

ok("a new client notifies the admin by email (Dutch, to the admin's address)", notified.length === 1 && notified[0].to === "dino@example.com" && /Nieuwe klant: Alice/.test(notified[0].subject), JSON.stringify(notified.map((m) => [m.to, m.subject])));
ok("the notification links to the dashboard and shows the count", /#\/admin/.test(notified[0].text) && /1 klant\b/.test(notified[0].text), notified[0].text);
ok("the admin's own setup is not announced", !notified.some((m) => /Dino/.test(m.subject)));

const bob = new Client();
r = await bob.req("POST", "/api/auth/register", { email: "bob@example.com", password: "bob-long-password!", name: "Bob", consent: true });
ok("second client registers", r.status === 201);
ok("each new client gets announced", notified.length === 2 && /Bob/.test(notified[1].subject) && /2 klanten/.test(notified[1].text));

process.env.ADMIN_NOTIFY_EMAIL = "owner@example.com, second@example.com";
const before = notified.length;
await new Client().req("POST", "/api/auth/register", { email: "notify1@example.com", password: "notify-long-password", name: "Notify One", consent: true });
ok("ADMIN_NOTIFY_EMAIL overrides the recipients", notified.length === before + 2 && notified.slice(before).map((m) => m.to).sort().join() === "owner@example.com,second@example.com", JSON.stringify(notified.slice(before).map((m) => m.to)));
delete process.env.ADMIN_NOTIFY_EMAIL;

// --- auth
r = await new Client().req("GET", "/api/data");
ok("data requires login", r.status === 401);
r = await new Client().req("POST", "/api/auth/login", { email: "alice@example.com", password: "wrong-password-x" });
ok("wrong password -> 401 generic", r.status === 401 && r.json.error.code === "invalid_credentials");
r = await new Client().req("POST", "/api/auth/login", { email: "nobody@example.com", password: "wrong-password-x" });
ok("unknown email -> same 401", r.status === 401 && r.json.error.code === "invalid_credentials");
const alice2 = new Client();
r = await alice2.req("POST", "/api/auth/login", { email: "alice@example.com", password: "alice-long-password" });
ok("login works", r.status === 200 && r.json.user.name === "Alice");
r = await alice2.req("GET", "/api/auth/me");
ok("me returns the user", r.status === 200 && r.json.user.email === "alice@example.com");

// --- data isolation
r = await alice.req("PUT", "/api/accounts/acc-a", account("acc-a"));
ok("alice saves account", r.status === 200, JSON.stringify(r.json));
r = await alice.req("POST", "/api/trades/bulk", { trades: [trade("t1", "acc-a", 50), trade("t2", "acc-a", -30, { mood: "Wraakzuchtig" }), trade("t3", "acc-a", 80)] });
ok("alice bulk-saves 3 trades", r.status === 200 && r.json.count === 3, JSON.stringify(r.json));
r = await alice.req("POST", "/api/trades/bulk", { trades: [trade("t1", "acc-a", 55)] });
ok("bulk upsert is idempotent", r.status === 200);
r = await alice.req("PUT", "/api/trades/tx", trade("tx", "no-such-account", 1));
ok("trade on unknown account rejected", r.status === 400 && r.json.error.code === "unknown_account", JSON.stringify(r.json));
r = await alice.req("PUT", "/api/trades/ty", { ...trade("ty", "acc-a", 1), qty: -3 });
ok("invalid trade rejected by schema", r.status === 400 && r.json.error.code === "invalid_input");
r = await alice.req("GET", "/api/data");
ok("alice sees 1 account + 3 trades, t1 updated", r.json.accounts.length === 1 && r.json.trades.length === 3 && r.json.trades.find((t) => t.id === "t1").pnl === 55);
ok("numbers come back as numbers", typeof r.json.trades[0].openedAt === "number" && typeof r.json.accounts[0].startBalance === "number");

r = await bob.req("GET", "/api/data");
ok("bob sees none of alice's data", r.json.accounts.length === 0 && r.json.trades.length === 0);
r = await bob.req("PUT", "/api/accounts/acc-a", account("acc-a", { name: "Bob's own" }));
ok("same account id for another user is separate", r.status === 200);
r = await bob.req("DELETE", "/api/trades/t1");
r = await alice.req("GET", "/api/data");
ok("bob cannot delete alice's trade", r.json.trades.some((t) => t.id === "t1") && r.json.accounts[0].name === "Prop");
r = await bob.req("GET", "/api/screenshots/t1");
ok("bob cannot read alice's screenshot", r.status === 404);

// --- screenshots
const png = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
r = await alice.req("PUT", "/api/screenshots/t1", { data: png });
ok("screenshot saved", r.status === 200);
r = await alice.req("PUT", "/api/screenshots/t1", { data: "data:text/html;base64,PHNjcmlwdD4=" });
ok("non-image screenshot rejected", r.status === 400);
r = await alice.req("GET", "/api/screenshots/t1");
ok("screenshot readable", r.json.data === png);
r = await alice.req("GET", "/api/data");
ok("hasScreenshot flag set", r.json.trades.find((t) => t.id === "t1").hasScreenshot === true);

// --- settings
r = await alice.req("PUT", "/api/settings", { unit: "R", lang: "en", timezone: "America/New_York", imports: [{ id: "i", filename: "a.csv" }] });
ok("settings saved", r.status === 200);
r = await alice.req("GET", "/api/data");
ok("settings round-trip", r.json.settings.unit === "R" && r.json.settings.imports.length === 1);

// --- authorisation of admin routes
r = await alice.req("GET", "/api/admin/users");
ok("client cannot list users", r.status === 403);
r = await new Client().req("GET", "/api/admin/users");
ok("anonymous cannot list users", r.status === 401);

// --- admin view
r = await admin.req("GET", "/api/admin/users");
const users = r.json.users;
const aliceRow = users.find((u) => u.email === "alice@example.com");
ok("admin lists all 4 users", r.status === 200 && users.length === 4);
ok("admin sees alice's aggregates", aliceRow.trades === 3 && Math.abs(aliceRow.net - 105) < 1e-9 && aliceRow.wins === 2 && aliceRow.losses === 1 && aliceRow.accounts === 1, JSON.stringify(aliceRow));
ok("admin sees last trade date", typeof aliceRow.lastTradeAt === "number");
r = await admin.req("GET", `/api/admin/users/${aliceRow.id}/data`);
ok("admin reads alice's journal", r.status === 200 && r.json.trades.length === 3 && r.json.user.name === "Alice");
r = await admin.req("GET", `/api/admin/users/${aliceRow.id}/screenshots/t1`);
ok("admin reads alice's screenshot", r.json.data === png);
r = await admin.req("GET", "/api/admin/users/not-a-uuid/data");
ok("bad id -> 404", r.status === 404);
r = await admin.req("GET", `/api/admin/users/${aliceRow.id}/data`);
r = await alice.req("GET", "/api/me/access-log");
ok("alice sees the access log (deduped to 1)", r.json.entries.length === 1 && r.json.entries[0].actor === "Dino" && r.json.entries[0].action === "view_journal", JSON.stringify(r.json));
r = await bob.req("GET", "/api/me/access-log");
ok("bob's access log is empty", r.json.entries.length === 0);
r = await admin.req("PUT", `/api/trades/t1`, trade("t1", "acc-a", 1));
r = await alice.req("GET", "/api/data");
ok("admin's write only touches admin's own data", r.json.trades.find((t) => t.id === "t1").pnl === 55);

// --- disable user
r = await admin.req("PATCH", `/api/admin/users/${aliceRow.id}`, { status: "disabled" });
ok("admin disables alice", r.status === 200);
r = await alice.req("GET", "/api/data");
ok("disabled user's session stops working", r.status === 401);
r = await new Client().req("POST", "/api/auth/login", { email: "alice@example.com", password: "alice-long-password" });
ok("disabled user cannot log in", r.status === 403 && r.json.error.code === "account_disabled");
const adminRow = users.find((u) => u.role === "admin");
r = await admin.req("PATCH", `/api/admin/users/${adminRow.id}`, { status: "disabled" });
ok("admin cannot disable self", r.status === 400);
r = await admin.req("PATCH", `/api/admin/users/${aliceRow.id}`, { status: "active" });
ok("admin re-enables alice", r.status === 200);

// --- export / delete
const alice3 = new Client();
await alice3.req("POST", "/api/auth/login", { email: "alice@example.com", password: "alice-long-password" });
r = await alice3.req("GET", "/api/me/export");
ok("export contains trades + screenshots", r.json.trades.length === 3 && r.json.screenshots.t1 === png && r.json.app === "dcramere-journal");
r = await alice3.req("POST", "/api/import", { accounts: [account("acc-b", { name: "Imported" })], trades: [trade("i1", "acc-b", 10)] });
ok("import adds accounts then trades", r.status === 200 && r.json.trades === 1);
r = await alice3.req("DELETE", "/api/me/data");
r = await alice3.req("GET", "/api/data");
ok("delete-my-data wipes accounts, trades, screenshots", r.json.accounts.length === 0 && r.json.trades.length === 0);
r = await admin.req("DELETE", "/api/me");
ok("last admin cannot delete themselves", r.status === 409 && r.json.error.code === "last_admin");
r = await bob.req("DELETE", "/api/me");
ok("client deletes own account", r.status === 200);
r = await bob.req("GET", "/api/data");
ok("deleted account's session is gone", r.status === 401);
r = await admin.req("GET", "/api/admin/users");
ok("deleted user vanishes from admin list", r.json.users.length === 3);

// --- rate limiting
const spam = new Client();
let last;
for (let i = 0; i < 10; i += 1) last = await spam.req("POST", "/api/auth/login", { email: "spam@example.com", password: "wrong-password-x" });
ok("login is rate limited per email", last.status === 429, String(last.status));
const regs = new Client();
for (let i = 0; i < 6; i += 1) last = await regs.req("POST", "/api/auth/register", { email: `u${i}@example.com`, password: "long-enough-password", name: `U${i}`, consent: true });
ok("registration is rate limited per IP", last.status === 429, String(last.status));

// --- forgot / reset password
const tokenFrom = (m) => decodeURIComponent(m.text.match(/#\/reset\?token=([^\s]+)/)[1]);
r = await anon.req("GET", "/api/health");
ok("health reports mail is configured", r.json.mail === true);

const carol = new Client();
r = await carol.req("POST", "/api/auth/register", { email: "carol@example.com", password: "carol-long-password", name: "Carol", consent: true, lang: "en" });
const carolSession = carol.cookie;

mails.length = 0;
r = await new Client().req("POST", "/api/auth/forgot", { email: "ghost@example.com" });
await flushDeferred();
ok("forgot for unknown email answers ok but sends nothing", r.status === 200 && r.json.ok === true && mails.length === 0);
r = await new Client().req("POST", "/api/auth/forgot", { email: "not-an-email" });
ok("forgot rejects invalid email", r.status === 400);

r = await new Client().req("POST", "/api/auth/forgot", { email: "Carol@Example.com" });
await flushDeferred();
ok("forgot for known email answers the same", r.status === 200 && r.json.ok === true);
ok("exactly one email, to carol, in English", mails.length === 1 && mails[0].to === "carol@example.com" && /Reset your password/.test(mails[0].subject), JSON.stringify(mails.map((m) => m.subject)));
ok("link points at the app with a reset token (in the fragment)", /^https:\/\/journal\.test\/#\/reset\?token=/.test(mails[0].text.match(/https:\/\/\S+/)[0]));
ok("email contains an html button too", /<a href="https:\/\/journal\.test\/#\/reset\?token=/.test(mails[0].html));
const token1 = tokenFrom(mails[0]);
const stored = await query(`SELECT token_hash FROM password_resets`);
ok("only a hash of the token is stored", stored.length === 1 && stored[0].token_hash !== token1 && stored[0].token_hash.length === 64);

r = await new Client().req("POST", "/api/auth/reset", { token: "x".repeat(43), password: "brand-new-password" });
ok("unknown token rejected", r.status === 400 && r.json.error.code === "invalid_token");
r = await new Client().req("POST", "/api/auth/reset", { token: token1, password: "short" });
ok("weak new password rejected", r.status === 400 && r.json.error.code === "invalid_input");

// a second request invalidates the first link
r = await new Client().req("POST", "/api/auth/forgot", { email: "carol@example.com" });
await flushDeferred();
const token2 = tokenFrom(mails[1]);
r = await new Client().req("POST", "/api/auth/reset", { token: token1, password: "brand-new-password" });
ok("an older link stops working after a new request", r.status === 400 && r.json.error.code === "invalid_token");

// expired link
await query(`UPDATE password_resets SET expires_at = 1 WHERE used_at IS NULL`);
r = await new Client().req("POST", "/api/auth/reset", { token: token2, password: "brand-new-password" });
ok("expired link rejected", r.status === 400 && r.json.error.code === "invalid_token");

// lock the account out with failed logins, then reset
const lock = new Client();
for (let i = 0; i < 9; i += 1) r = await lock.req("POST", "/api/auth/login", { email: "carol@example.com", password: "wrong-password-x" });
ok("carol is rate limited after failed logins", r.status === 429);
await new Client().req("POST", "/api/auth/forgot", { email: "carol@example.com" });
// per-email limit is 3/hour: 3rd request still sends
await flushDeferred();
const token3 = tokenFrom(mails[mails.length - 1]);
mails.length = 0;
r = await new Client().req("POST", "/api/auth/reset", { token: token3, password: "brand-new-password" });
await flushDeferred();
ok("reset succeeds with a fresh token", r.status === 200 && r.json.ok === true, JSON.stringify(r.json));
ok("a 'password changed' notice is emailed", mails.length === 1 && /changed/i.test(mails[0].subject));
r = await new Client().req("POST", "/api/auth/reset", { token: token3, password: "another-new-password" });
ok("a link works only once", r.status === 400 && r.json.error.code === "invalid_token");
const stale = new Client();
stale.cookie = carolSession;
r = await stale.req("GET", "/api/auth/me");
ok("reset logs out all existing sessions", r.status === 401);
r = await new Client().req("POST", "/api/auth/login", { email: "carol@example.com", password: "carol-long-password" });
ok("old password no longer works", r.status === 401);
r = await new Client().req("POST", "/api/auth/login", { email: "carol@example.com", password: "brand-new-password" });
ok("new password works and the earlier lockout is cleared", r.status === 200 && r.json.user.name === "Carol");

// the per-email limit answers ok but stays silent
mails.length = 0;
for (let i = 0; i < 4; i += 1) await new Client().req("POST", "/api/auth/forgot", { email: "dave-unknown@example.com" });
const eve = new Client();
await eve.req("POST", "/api/auth/register", { email: "eve@example.com", password: "eve-long-password!", name: "Eve", consent: true });
mails.length = 0;
for (let i = 0; i < 5; i += 1) r = await new Client().req("POST", "/api/auth/forgot", { email: "eve@example.com" });
await flushDeferred();
ok("per-email limit: always 200 but at most 3 emails per hour", r.status === 200 && mails.length === 3, String(mails.length));

// deactivated users get no reset email
const evRow = (await admin.req("GET", "/api/admin/users")).json.users.find((u) => u.email === "eve@example.com");
await admin.req("PATCH", `/api/admin/users/${evRow.id}`, { status: "disabled" });
await query(`DELETE FROM rate_limits WHERE key LIKE 'forgot:%'`);
mails.length = 0;
await new Client().req("POST", "/api/auth/forgot", { email: "eve@example.com" });
await flushDeferred();
ok("deactivated account receives no reset email", mails.length === 0);

// --- admin-created reset link (no email needed)
const zed = new Client();
await zed.req("POST", "/api/auth/register", { email: "zed@example.com", password: "zed-old-password!", name: "Zed", consent: true });
const zedSession = zed.cookie;
const zedRow = (await admin.req("GET", "/api/admin/users")).json.users.find((u) => u.email === "zed@example.com");
const adminSelf = (await admin.req("GET", "/api/auth/me")).json.user;

r = await zed.req("POST", `/api/admin/users/${zedRow.id}/reset-link`);
ok("a client cannot create reset links", r.status === 403);
r = await new Client().req("POST", `/api/admin/users/${zedRow.id}/reset-link`);
ok("anonymous cannot create reset links", r.status === 401);
r = await admin.req("POST", `/api/admin/users/${adminSelf.id}/reset-link`);
ok("admin cannot create a link for themselves/admins", r.status === 400 || r.status === 403);
r = await admin.req("POST", `/api/admin/users/not-a-uuid/reset-link`);
ok("bad id -> 404", r.status === 404);

mails.length = 0;
r = await admin.req("POST", `/api/admin/users/${zedRow.id}/reset-link`);
ok("admin creates a reset link", r.status === 200 && typeof r.json.token === "string" && r.json.token.length >= 40, JSON.stringify(r.json));
const hours = (r.json.expiresAt - Date.now()) / 3600000;
ok("admin link is valid for about 24 hours", hours > 23.9 && hours <= 24.01, String(hours));
const adminToken = r.json.token;
r = await new Client().req("POST", "/api/auth/reset", { token: adminToken, password: "zed-new-password!" });
ok("the client can use the link to choose a new password", r.status === 200);
r = await new Client().req("POST", "/api/auth/reset", { token: adminToken, password: "zed-other-password" });
ok("the admin link works only once", r.status === 400 && r.json.error.code === "invalid_token");
const zedStale = new Client();
zedStale.cookie = zedSession;
r = await zedStale.req("GET", "/api/auth/me");
ok("using the link logs the client out everywhere", r.status === 401);
r = await new Client().req("POST", "/api/auth/login", { email: "zed@example.com", password: "zed-new-password!" });
ok("client logs in with the new password", r.status === 200);

// the action is logged and visible to the client
const zed2 = new Client();
await zed2.req("POST", "/api/auth/login", { email: "zed@example.com", password: "zed-new-password!" });
r = await zed2.req("GET", "/api/me/access-log");
ok("the client sees that the admin made a reset link", r.json.entries.some((e) => e.action === "reset_link" && e.actor === "Dino"), JSON.stringify(r.json));

// a new link replaces the previous one; disabled clients get none
r = await admin.req("POST", `/api/admin/users/${zedRow.id}/reset-link`);
const l1 = r.json.token;
r = await admin.req("POST", `/api/admin/users/${zedRow.id}/reset-link`);
const l2 = r.json.token;
r = await new Client().req("POST", "/api/auth/reset", { token: l1, password: "zed-third-password!" });
ok("an older admin link is invalidated by a newer one", r.status === 400);
await admin.req("PATCH", `/api/admin/users/${zedRow.id}`, { status: "disabled" });
r = await admin.req("POST", `/api/admin/users/${zedRow.id}/reset-link`);
ok("no link for a deactivated client", r.status === 409 && r.json.error.code === "user_disabled");
r = await new Client().req("POST", "/api/auth/reset", { token: l2, password: "zed-fourth-password!" });
ok("an existing link stops working when the client is deactivated", r.status === 400);

// --- rapporten
const NY = "America/New_York";
const lastWeek = lastCompletedPeriods("week", 1, todayInTz(NY))[0];
const lastMonth = lastCompletedPeriods("month", 1, todayInTz(NY))[0];
const at = (date, h) => {
  const [y, m, d] = date.split("-").map(Number);
  return wallToEpoch(y, m, d, h, 0, 0, NY);
};
const midWeek = (h) => at(lastWeek.start, h) + 2 * 86400000; // woensdag
const rt = (id, accountId, pnl, ms, over = {}) => ({ ...trade(id, accountId, pnl), openedAt: ms - 60000, closedAt: ms, ...over });

const rita = new Client();
await rita.req("POST", "/api/auth/register", { email: "rita@example.com", password: "rita-long-password", name: "Rita", consent: true });
await rita.req("PUT", "/api/accounts/ra", account("ra"));
const ritaRows = (await admin.req("GET", "/api/admin/users")).json.users.find((u) => u.email === "rita@example.com");

r = await rita.req("GET", "/api/reports");
ok("no trades -> no reports", r.status === 200 && r.json.reports.length === 0);

await rita.req("POST", "/api/trades/bulk", {
  trades: [
    rt("w1", "ra", 120, midWeek(10), { mood: "Rustig" }),
    rt("w2", "ra", 90, midWeek(11), { mood: "Rustig" }),
    rt("w3", "ra", 80, midWeek(12), { mood: "Rustig" }),
    rt("w4", "ra", -110, midWeek(14), { mood: "Wraakzuchtig" }),
    rt("w5", "ra", -120, midWeek(15), { mood: "Wraakzuchtig" }),
    rt("w6", "ra", -100, midWeek(16), { mood: "Wraakzuchtig" }),
    rt("m1", "ra", 40, at(lastMonth.start, 12) + 86400000, { mood: "Rustig" }),
  ],
});
r = await rita.req("GET", "/api/reports");
const week = r.json.reports.find((x) => x.kind === "week" && x.periodKey === lastWeek.key);
ok("a weekly report is created for the last completed week", !!week, JSON.stringify(r.json.reports.map((x) => x.kind + x.periodKey)));
ok("the weekly report has the right numbers", week.data.kpis.trades === 6 && Math.abs(week.data.kpis.net - -40) < 1e-9, JSON.stringify(week?.data.kpis));
ok("it knows calm is best and revenge is worst", week.data.good.some((i) => i.id === "best_mood" && i.p.mood === "Rustig") && week.data.improve.some((i) => i.id === "worst_mood" && i.p.mood === "Wraakzuchtig"));
ok("it has a focus", typeof week.data.focus.id === "string");
ok("a monthly report exists too", r.json.reports.some((x) => x.kind === "month"));

const firstId = week.id;
r = await rita.req("GET", "/api/reports");
ok("asking again does not create duplicates", r.json.reports.filter((x) => x.kind === "week" && x.periodKey === lastWeek.key).length === 1 && r.json.reports.find((x) => x.periodKey === lastWeek.key && x.kind === "week").id === firstId);

await rita.req("PUT", "/api/trades/w7", rt("w7", "ra", 200, midWeek(17), { mood: "Rustig" }));
r = await rita.req("GET", "/api/reports");
const refreshed = r.json.reports.find((x) => x.kind === "week" && x.periodKey === lastWeek.key);
ok("a late trade refreshes the same report", refreshed.id === firstId && refreshed.data.kpis.trades === 7 && Math.abs(refreshed.data.kpis.net - 160) < 1e-9, JSON.stringify(refreshed.data.kpis));

// a stored report from an older version is rebuilt
await query(`UPDATE reports SET data = jsonb_set(data, '{version}', '1') WHERE id = $1::uuid`, [firstId]);
r = await rita.req("GET", "/api/reports");
const upgraded = r.json.reports.find((x) => x.id === firstId);
ok("an outdated report format is rebuilt in place", upgraded && upgraded.data.version >= 2 && upgraded.data.headline?.id === "net_positive", JSON.stringify(upgraded?.data.version));

// isolation and admin access
r = await alice3.req("GET", "/api/reports");
ok("another client sees none of rita's reports", r.status === 200 && !r.json.reports.some((x) => x.id === firstId));
r = await new Client().req("GET", "/api/reports");
ok("reports need a login", r.status === 401);
r = await rita.req("GET", `/api/admin/users/${ritaRows.id}/reports`);
ok("a client cannot use the admin reports route", r.status === 403);
r = await admin.req("GET", `/api/admin/users/${ritaRows.id}/reports`);
ok("the admin reads a client's reports", r.status === 200 && r.json.reports.some((x) => x.id === firstId));
r = await rita.req("GET", "/api/me/access-log");
ok("that visit is logged for the client", r.json.entries.some((e) => e.action === "view_journal" && e.actor === "Dino"));
r = await admin.req("GET", "/api/admin/users/not-a-uuid/reports");
ok("bad id -> 404", r.status === 404);

r = await admin.req("GET", "/api/admin/reports/latest");
const mine = r.json.items.find((i) => i.user.name === "Rita");
ok("the admin overview lists rita's latest weekly report", r.status === 200 && mine && mine.report.kind === "week" && mine.report.data.kpis.trades === 7);
ok("the overview only holds active clients, not admins", r.json.items.every((i) => i.user.name !== "Dino"));
r = await rita.req("GET", "/api/admin/reports/latest");
ok("a client cannot use the admin overview", r.status === 403);

// cron
delete process.env.CRON_SECRET;
r = await new Client().req("GET", "/api/cron/reports");
ok("cron without CRON_SECRET does nothing", r.status === 200 && r.json.skipped);
process.env.CRON_SECRET = "cron-test-secret";
r = await new Client().req("GET", "/api/cron/reports", undefined, { Authorization: "Bearer wrong" });
ok("cron with a wrong secret is rejected", r.status === 401);
r = await new Client().req("GET", "/api/cron/reports");
ok("cron without a secret header is rejected", r.status === 401);
r = await new Client().req("GET", "/api/cron/reports", undefined, { Authorization: "Bearer cron-test-secret" });
ok("cron with the right secret generates reports", r.status === 200 && r.json.ok === true && r.json.users >= 1, JSON.stringify(r.json));
delete process.env.CRON_SECRET;

// removing the trades removes the report
await rita.req("DELETE", "/api/accounts/ra");
r = await rita.req("GET", "/api/reports");
ok("reports disappear when the trades are gone", r.json.reports.length === 0);

// no mail provider configured -> 503, and health says so
setMailer(null);
delete process.env.RESEND_API_KEY;
r = await new Client().req("POST", "/api/auth/forgot", { email: "carol@example.com" });
ok("without a mail provider forgot answers 503", r.status === 503 && r.json.error.code === "mail_not_configured");
r = await anon.req("GET", "/api/health");
ok("health reports mail is not configured", r.json.mail === false);

// --- notifications are capped so a signup flood cannot fill the inbox
ok("new-client notifications are capped at 10 signups per hour", new Set(notified.map((m) => m.subject)).size === 10, String(new Set(notified.map((m) => m.subject)).size));

// --- the Resend test sender mails only the owner: clients get no reset mail, admin notifications stay possible
setMailer(null);
process.env.RESEND_API_KEY = "re_test";
process.env.RESEND_FROM_EMAIL = "DCRAMERE Journal <onboarding@resend.dev>";
r = await anon.req("GET", "/api/health");
ok("with the test sender, client mail is reported as unavailable", r.json.mail === false);
r = await new Client().req("POST", "/api/auth/forgot", { email: "carol@example.com" });
ok("with the test sender, forgot-password answers 503", r.status === 503);
process.env.RESEND_FROM_EMAIL = "DCRAMERE Journal <journal@real-domain.example>";
r = await anon.req("GET", "/api/health");
ok("with a real domain, client mail is available", r.json.mail === true);
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;

// --- logout
r = await admin.req("POST", "/api/auth/logout");
r = await admin.req("GET", "/api/auth/me");
ok("logout invalidates the session", r.status === 401);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
server.close();
process.exit(fails ? 1 : 0);
