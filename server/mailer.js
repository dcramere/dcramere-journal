// E-mail versturen via Resend (https://resend.com). Eén functie, dus makkelijk te vervangen.
// Omgevingsvariabelen: RESEND_API_KEY, MAIL_FROM ("DCRAMERE Journal <journal@jouwdomein.nl>"), APP_URL.
let override = null;

export function setMailer(fn) {
  override = fn;
}

export function isMailConfigured() {
  return Boolean(override || (process.env.RESEND_API_KEY && process.env.MAIL_FROM));
}

// Basis-URL van de site, voor de link in de e-mail. Nooit uit de Host-header afleiden.
export function appUrl() {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : null;
}

export async function sendMail({ to, subject, text, html }) {
  if (override) return override({ to, subject, text, html });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`mail provider answered ${res.status}`);
  return undefined;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const COPY = {
  nl: {
    resetSubject: "Wachtwoord opnieuw instellen — DCRAMERE Journal",
    hi: (n) => `Hoi ${n},`,
    resetIntro: "Je hebt gevraagd om je wachtwoord opnieuw in te stellen. Klik op de knop om een nieuw wachtwoord te kiezen. De link is 1 uur geldig en kan één keer worden gebruikt.",
    resetButton: "Nieuw wachtwoord kiezen",
    resetIgnore: "Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren; je wachtwoord blijft ongewijzigd.",
    changedSubject: "Je wachtwoord is gewijzigd — DCRAMERE Journal",
    changedBody: "Je wachtwoord is zojuist gewijzigd en je bent overal uitgelogd. Was jij dit niet? Vraag dan direct een nieuw wachtwoord aan via de inlogpagina en neem contact op met je coach.",
  },
  en: {
    resetSubject: "Reset your password — DCRAMERE Journal",
    hi: (n) => `Hi ${n},`,
    resetIntro: "You asked to reset your password. Click the button to choose a new one. The link is valid for 1 hour and can be used once.",
    resetButton: "Choose a new password",
    resetIgnore: "Didn't ask for this? You can ignore this email; your password stays unchanged.",
    changedSubject: "Your password was changed — DCRAMERE Journal",
    changedBody: "Your password was just changed and you were logged out everywhere. Wasn't you? Request a new password from the login page right away and contact your coach.",
  },
};

const shell = (inner) =>
  `<div style="background:#0A0A0A;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#141210;border:1px solid #2A241A;border-radius:12px;padding:28px;color:#F1ECDD">
      <div style="font-family:Georgia,serif;color:#D4AF37;font-size:20px;font-weight:bold;letter-spacing:.04em;margin-bottom:18px">DCRAMERE JOURNAL</div>
      ${inner}
    </div>
  </div>`;

export function resetEmail({ lang, name, link }) {
  const c = COPY[lang === "en" ? "en" : "nl"];
  return {
    subject: c.resetSubject,
    text: `${c.hi(name)}\n\n${c.resetIntro}\n\n${link}\n\n${c.resetIgnore}\n`,
    html: shell(`
      <p style="margin:0 0 12px">${esc(c.hi(name))}</p>
      <p style="margin:0 0 20px;line-height:1.5">${esc(c.resetIntro)}</p>
      <p style="margin:0 0 20px"><a href="${esc(link)}" style="background:#D4AF37;color:#0A0A0A;text-decoration:none;font-weight:bold;padding:11px 18px;border-radius:8px;display:inline-block">${esc(c.resetButton)}</a></p>
      <p style="margin:0 0 6px;color:#8C8577;font-size:12px;word-break:break-all">${esc(link)}</p>
      <p style="margin:16px 0 0;color:#8C8577;font-size:12px;line-height:1.5">${esc(c.resetIgnore)}</p>`),
  };
}

export function passwordChangedEmail({ lang, name }) {
  const c = COPY[lang === "en" ? "en" : "nl"];
  return {
    subject: c.changedSubject,
    text: `${c.hi(name)}\n\n${c.changedBody}\n`,
    html: shell(`<p style="margin:0 0 12px">${esc(c.hi(name))}</p><p style="margin:0;line-height:1.5">${esc(c.changedBody)}</p>`),
  };
}
