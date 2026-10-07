// Lokale API-server voor ontwikkeling: draait dezelfde handlers als Vercel,
// maar op een ingebouwde Postgres (PGlite) in plaats van Neon.
//   npm run dev:api        (data blijft bewaard in .dev-db)
//   DEV_DB=memory npm run dev:api
import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { setDatabase } from "../server/db.js";
import { migrate } from "../server/migrations.js";
import { setMailer } from "../server/mailer.js";
import { handle } from "../server/router.js";

process.env.ADMIN_SETUP_TOKEN = process.env.ADMIN_SETUP_TOKEN || "dev-setup-token";
process.env.APP_URL = process.env.APP_URL || "http://localhost:5173";
// Lokaal worden e-mails niet verstuurd maar in de console getoond (inclusief de resetlink).
setMailer(async (m) => console.log(`\n[dev-mail] naar ${m.to} — ${m.subject}\n${m.text}`));

export async function createDevServer({ memory = false } = {}) {
  const pg = memory ? new PGlite() : new PGlite("./.dev-db");
  const run = async (text, params) => (await pg.query(text, params || [])).rows;
  setDatabase({ query: run });
  await migrate(run);
  return http.createServer((req, res) => {
    handle(req, res);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.API_PORT || 8787);
  const server = await createDevServer({ memory: process.env.DEV_DB === "memory" });
  server.listen(port, () => console.log(`[dev-api] http://localhost:${port}  (setup token: ${process.env.ADMIN_SETUP_TOKEN})`));
}
