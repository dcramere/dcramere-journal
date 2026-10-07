// Draait de database-migraties. Tijdens de Vercel-build (zie vercel.json) en handmatig:
//   DATABASE_URL=postgres://... npm run db:migrate
// Zonder DATABASE_URL wordt dit overgeslagen, zodat de app dan in lokale modus blijft werken.
import { neon } from "@neondatabase/serverless";
import { migrate } from "../server/migrations.js";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] geen DATABASE_URL gevonden — migraties overgeslagen (lokale modus).");
  process.exit(0);
}

const sql = neon(url);
try {
  const n = await migrate((text, params) => sql.query(text, params), (m) => console.log(`[migrate] ${m}`));
  console.log(`[migrate] klaar (${n} nieuwe migratie${n === 1 ? "" : "s"}).`);
} catch (err) {
  console.error("[migrate] mislukt:", err.message);
  process.exit(1);
}
