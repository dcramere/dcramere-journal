import { query } from "../db.js";
import { ApiError } from "../http.js";
import { safeEqual } from "../auth.js";
import { ensureAllReports, ensureReports, latestWeekly, listReports } from "../reports.js";
import { aiConfigured, generateAi } from "../ai.js";
import { logAccess } from "./admin.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function myReports({ user }) {
  await ensureReports(user.id);
  return { reports: await listReports(user.id), aiEnabled: aiConfigured() };
}

export async function userReports({ user, params }) {
  if (!UUID.test(params.id)) throw new ApiError(404, "not_found");
  const [target] = await query(`SELECT id FROM users WHERE id = $1::uuid`, [params.id]);
  if (!target) throw new ApiError(404, "not_found");
  if (target.id !== user.id) await logAccess(user.id, target.id, "view_journal");
  await ensureReports(target.id);
  return { reports: await listReports(target.id), aiEnabled: aiConfigured() };
}

export async function latestReports() {
  return { items: await latestWeekly() };
}

// Dagelijkse cron (zie vercel.json). Draait alleen met CRON_SECRET; Vercel stuurt die als Bearer-token mee.
export async function cronReports({ req }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: true, skipped: "CRON_SECRET ontbreekt" };
  if (!safeEqual(req.headers.authorization || "", `Bearer ${secret}`)) throw new ApiError(401, "unauthorized");
  return { ok: true, users: await ensureAllReports() };
}

// Uitgebreide AI-uitleg bij een rapport: de klant voor het eigen rapport, de beheerder voor dat van een klant.
export async function myReportAi({ user, params, body }) {
  if (!UUID.test(params.id)) throw new ApiError(404, "not_found");
  return generateAi({ actor: user, ownerId: user.id, reportId: params.id, body });
}

export async function userReportAi({ user, params, body }) {
  if (!UUID.test(params.id) || !UUID.test(params.reportId)) throw new ApiError(404, "not_found");
  const [target] = await query(`SELECT id FROM users WHERE id = $1::uuid`, [params.id]);
  if (!target) throw new ApiError(404, "not_found");
  if (target.id !== user.id) await logAccess(user.id, target.id, "view_journal");
  return generateAi({ actor: user, ownerId: target.id, reportId: params.reportId, body });
}
