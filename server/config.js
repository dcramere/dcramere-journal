// Serverconfiguratie. Alles komt uit omgevingsvariabelen (zie README).
export const config = {
  get databaseUrl() {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  },
  // Eenmalig geheim waarmee de eerste beheerder zich aanmeldt (/#/setup).
  get setupToken() {
    return process.env.ADMIN_SETUP_TOKEN || "";
  },
  cookieName: "dj_session",
  sessionDays: 30,
  maxBodyBytes: 4 * 1024 * 1024,
};
