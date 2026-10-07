import { neon } from "@neondatabase/serverless";
import { config } from "./config.js";

// De database is vervangbaar (lokale dev en tests gebruiken PGlite).
let override = null;
let cached = null;

export function setDatabase(impl) {
  override = impl;
}

export function isConfigured() {
  return Boolean(override || config.databaseUrl);
}

function client() {
  if (override) return override;
  if (!cached) {
    const sql = neon(config.databaseUrl);
    cached = { query: (text, params) => sql.query(text, params || []) };
  }
  return cached;
}

// Geeft altijd een array rijen terug.
export async function query(text, params = []) {
  return client().query(text, params);
}

export const num = (v) => (v == null ? null : Number(v));
