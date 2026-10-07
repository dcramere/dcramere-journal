import { tr } from "./i18n.js";

// Dunne fetch-wrapper rond de /api-routes (zelfde origin, sessie via HttpOnly-cookie).
// T() markeert tekst voor de vertaalcontrole; vertalen gebeurt in errorText().
const T = (s) => s;
const MESSAGES = {
  network: T("Geen verbinding met de server."),
  invalid_credentials: T("E-mailadres of wachtwoord klopt niet."),
  email_taken: T("Dit e-mailadres heeft al een account."),
  rate_limited: T("Te veel pogingen. Probeer het later opnieuw."),
  consent_required: T("Je moet akkoord gaan met de privacyvoorwaarden."),
  account_disabled: T("Dit account is gedeactiveerd. Neem contact op met je coach."),
  bad_setup_token: T("Ongeldige setup-code."),
  setup_closed: T("De beheerder is al ingesteld."),
  invalid_input: T("Controleer je invoer (wachtwoord minimaal 10 tekens)."),
  unauthorized: T("Je sessie is verlopen. Log opnieuw in."),
  forbidden: T("Geen toegang."),
  not_found: T("Niet gevonden."),
  last_admin: T("Je bent de enige beheerder en kunt je account niet verwijderen."),
  not_configured: T("De server is nog niet ingesteld."),
  unknown_account: T("Onbekend account."),
  invalid_token: T("Deze link is ongeldig of verlopen. Vraag een nieuwe aan."),
  user_disabled: T("Deze klant is gedeactiveerd. Activeer de klant eerst."),
  mail_not_configured: T("E-mail is nog niet ingesteld op de server."),
};

export function errorText(code) {
  return tr(MESSAGES[code] || T("Er ging iets mis op de server. Probeer het opnieuw."));
}

export class ApiError extends Error {
  constructor(status, code, issues) {
    super(errorText(code));
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-DJ-CSRF": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Geen JSON (bijv. een 404-pagina van de dev-server).
  }
  if (!res.ok) {
    const code = data?.error?.code || "server_error";
    if (res.status === 401 && onUnauthorized && !path.startsWith("/api/auth/")) onUnauthorized();
    throw new ApiError(res.status, code, data?.error?.issues);
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body ?? {}),
  put: (path, body) => request("PUT", path, body ?? {}),
  patch: (path, body) => request("PATCH", path, body ?? {}),
  del: (path) => request("DELETE", path),
};
