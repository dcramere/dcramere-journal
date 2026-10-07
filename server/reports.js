// Rapporten per klant bijhouden: afgeronde weken en maanden worden berekend zodra er trades in zitten
// en opnieuw berekend als er later nog trades bijkomen of verdwijnen.
import { REPORT_VERSION, buildReport, lastCompletedPeriods } from "../src/lib/report.js";
import { DEFAULT_TZ } from "../src/lib/model.js";
import { addDays, parseDate, todayInTz, wallToEpoch } from "../src/lib/tz.js";
import { query } from "./db.js";
import { loadJournal } from "./mappers.js";

const WEEKS = 4;
const MONTHS = 3;

function validTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

// [begin, einde) van een periode in milliseconden, in de tijdzone van de gebruiker.
function bounds(period, tz) {
  const a = parseDate(period.start);
  const b = parseDate(addDays(period.end, 1));
  return [wallToEpoch(a.y, a.mo, a.d, 0, 0, 0, tz), wallToEpoch(b.y, b.mo, b.d, 0, 0, 0, tz)];
}

const mapReport = (r) => ({
  id: r.id,
  kind: r.kind,
  periodKey: r.period_key,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  data: r.data,
  createdAt: Number(r.created_at),
});

export async function ensureReports(userId) {
  const [row] = await query(`SELECT settings->>'timezone' AS tz FROM user_settings WHERE user_id = $1::uuid`, [userId]);
  const tz = validTimezone(row?.tz || DEFAULT_TZ);
  const today = todayInTz(tz);
  const periods = [
    ...lastCompletedPeriods("week", WEEKS, today).map((p) => ({ kind: "week", ...p })),
    ...lastCompletedPeriods("month", MONTHS, today).map((p) => ({ kind: "month", ...p })),
  ];
  const ranges = periods.map((p) => bounds(p, tz));
  const from = Math.min(...ranges.map((r) => r[0]));
  const to = Math.max(...ranges.map((r) => r[1]));

  const closed = (
    await query(`SELECT closed_at FROM trades WHERE user_id = $1::uuid AND closed_at >= $2::bigint AND closed_at < $3::bigint`, [userId, from, to])
  ).map((r) => Number(r.closed_at));
  const existing = new Map(
    (await query(`SELECT kind, period_key, (data->'kpis'->>'trades')::int AS n, (data->>'version')::int AS v FROM reports WHERE user_id = $1::uuid`, [userId])).map((r) => [
      `${r.kind}:${r.period_key}`,
      { n: Number(r.n), v: Number(r.v) },
    ])
  );

  const rebuild = [];
  const drop = [];
  periods.forEach((p, i) => {
    const [a, b] = ranges[i];
    const count = closed.filter((ms) => ms >= a && ms < b).length;
    const known = existing.get(`${p.kind}:${p.key}`);
    if (count > 0 && (!known || known.n !== count || known.v !== REPORT_VERSION)) rebuild.push(p);
    if (count === 0 && known) drop.push(p);
  });
  for (const p of drop) {
    await query(`DELETE FROM reports WHERE user_id = $1::uuid AND kind = $2 AND period_key = $3`, [userId, p.kind, p.key]);
  }
  if (!rebuild.length) return;

  const { accounts, trades } = await loadJournal(query, userId);
  for (const p of rebuild) {
    const data = buildReport({ trades, accounts, tz, kind: p.kind, start: p.start, end: p.end });
    if (!data) continue;
    await query(
      `INSERT INTO reports (user_id, kind, period_key, period_start, period_end, data, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7::bigint)
       ON CONFLICT (user_id, kind, period_key) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
      [userId, p.kind, p.key, p.start, p.end, JSON.stringify(data), Date.now()]
    );
  }
}

export async function listReports(userId) {
  const rows = await query(
    `SELECT id, kind, period_key, period_start, period_end, data, created_at FROM reports
     WHERE user_id = $1::uuid ORDER BY period_start DESC, kind LIMIT 60`,
    [userId]
  );
  return rows.map(mapReport);
}

export async function ensureAllReports() {
  const users = await query(`SELECT id FROM users WHERE status = 'active' AND role = 'client' ORDER BY created_at LIMIT 1000`);
  for (const u of users) await ensureReports(u.id);
  return users.length;
}

// Het nieuwste weekrapport per klant, voor het beheerdersdashboard.
export async function latestWeekly() {
  await ensureAllReports();
  const rows = await query(
    `SELECT DISTINCT ON (r.user_id) r.user_id, u.name, u.email, r.id, r.kind, r.period_key, r.period_start, r.period_end, r.data, r.created_at
     FROM reports r JOIN users u ON u.id = r.user_id
     WHERE r.kind = 'week' AND u.status = 'active' AND u.role = 'client'
     ORDER BY r.user_id, r.period_start DESC`
  );
  return rows
    .map((r) => ({ user: { id: r.user_id, name: r.name, email: r.email }, report: mapReport(r) }))
    .sort((a, b) => (a.report.periodStart < b.report.periodStart ? 1 : a.report.periodStart > b.report.periodStart ? -1 : a.user.name.localeCompare(b.user.name)));
}
