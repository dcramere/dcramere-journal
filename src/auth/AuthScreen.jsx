import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { api } from "../api.js";
import { COLORS, MONO } from "../theme.js";
import { tr } from "../i18n.js";
import { Segmented } from "../ui/primitives.jsx";

function Input({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
      {label}
      <input
        {...props}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
      />
    </label>
  );
}

const linkStyle = { color: COLORS.textMuted, fontFamily: MONO };

// Inloggen, account maken, wachtwoord vergeten en nieuw wachtwoord kiezen.
// Met `setup` meldt de eerste beheerder zich aan (setup-code uit Vercel); met `resetToken` kiest iemand via de e-maillink een nieuw wachtwoord.
export function AuthScreen({ lang, onLang, onAuthed, setup = false, needsSetup = false, mail = false, resetToken = null }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [f, setF] = useState({ name: "", email: "", password: "", repeat: "", token: "", consent: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const resetting = resetToken !== null;
  const view = resetting ? "reset" : setup ? "register" : mode;
  const registering = view === "register";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    setDone(false);
  };

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (view === "reset" && f.password !== f.repeat) return setError(tr("De twee wachtwoorden zijn niet gelijk."));
    setBusy(true);
    try {
      if (view === "forgot") {
        await api.post("/api/auth/forgot", { email: f.email.trim() });
        setDone(true);
      } else if (view === "reset") {
        await api.post("/api/auth/reset", { token: resetToken, password: f.password });
        setDone(true);
      } else {
        const body = registering
          ? { email: f.email.trim(), password: f.password, name: f.name.trim(), lang, ...(setup ? { setupToken: f.token.trim() } : { consent: f.consent }) }
          : { email: f.email.trim(), password: f.password };
        const { user } = await api.post(registering ? "/api/auth/register" : "/api/auth/login", body);
        onAuthed(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title = view === "reset" ? tr("Nieuw wachtwoord kiezen") : view === "forgot" ? tr("Wachtwoord vergeten") : setup ? tr("Beheerder instellen") : null;
  const submitLabel = busy
    ? tr("Bezig…")
    : view === "reset"
    ? tr("Wachtwoord opslaan")
    : view === "forgot"
    ? tr("Stuur me een link")
    : setup
    ? tr("Beheerder aanmaken")
    : registering
    ? tr("Account maken")
    : tr("Inloggen");

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text }} className="font-sans flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={22} color={COLORS.gold} />
            <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.gold, letterSpacing: "0.04em" }} className="text-lg font-bold truncate">
              {tr("DCRAMERE JOURNAL")}
            </h1>
          </div>
          <Segmented
            size="sm"
            value={lang}
            onChange={onLang}
            ariaLabel="Taal / Language"
            options={[
              { value: "nl", label: "NL", raw: true },
              { value: "en", label: "EN", raw: true },
            ]}
          />
        </div>
        <p className="text-xs tracking-widest" style={{ color: COLORS.textMuted }}>
          {tr("SEE · DECIPHER · TRADE")}
        </p>

        <form
          onSubmit={submit}
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
        >
          {title ? (
            <h2 className="text-sm font-semibold">{title}</h2>
          ) : (
            <Segmented
              value={mode}
              onChange={switchMode}
              ariaLabel={tr("Inloggen of account maken")}
              options={[
                { value: "login", label: "Inloggen" },
                { value: "register", label: "Account maken" },
              ]}
            />
          )}

          {done && view === "forgot" && (
            <p role="status" className="text-xs leading-relaxed" style={{ color: COLORS.green }}>
              {tr("Bestaat er een account met dit e-mailadres, dan hebben we een link gestuurd om een nieuw wachtwoord te kiezen. De link is 1 uur geldig. Kijk ook in je spam.")}
            </p>
          )}
          {done && view === "reset" && (
            <>
              <p role="status" className="text-xs leading-relaxed" style={{ color: COLORS.green }}>
                {tr("Je wachtwoord is gewijzigd. Je kunt nu inloggen met je nieuwe wachtwoord.")}
              </p>
              <a href="#/journal" className="rounded-lg px-4 py-2 text-sm font-bold text-center" style={{ background: COLORS.gold, color: "#0A0A0A" }}>
                {tr("Inloggen")}
              </a>
            </>
          )}

          {!done && (
            <>
              {view === "reset" && !resetToken && (
                <p role="alert" className="text-xs" style={{ color: COLORS.red }}>
                  {tr("Deze link is ongeldig of verlopen. Vraag een nieuwe aan.")}
                </p>
              )}
              {registering && <Input label={tr("Naam")} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required maxLength={80} />}
              {view !== "reset" && (
                <Input label={tr("E-mailadres")} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
              )}
              {view !== "forgot" && (
                <Input
                  label={registering ? tr("Wachtwoord (minimaal 10 tekens)") : view === "reset" ? tr("Nieuw wachtwoord (minimaal 10 tekens)") : tr("Wachtwoord")}
                  type="password"
                  value={f.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete={registering || view === "reset" ? "new-password" : "current-password"}
                  required
                  minLength={registering || view === "reset" ? 10 : undefined}
                />
              )}
              {view === "reset" && (
                <Input label={tr("Herhaal nieuw wachtwoord")} type="password" value={f.repeat} onChange={(e) => set("repeat", e.target.value)} autoComplete="new-password" required minLength={10} />
              )}
              {registering && setup && (
                <Input label={tr("Setup-code (uit Vercel)")} type="password" value={f.token} onChange={(e) => set("token", e.target.value)} required autoComplete="off" />
              )}
              {registering && !setup && (
                <label className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                  <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5" required />
                  <span>
                    {tr("Ik begrijp dat de beheerder (mijn coach) mijn journal kan bekijken, alleen lezen, dat de beheerder bij een vergeten wachtwoord een resetlink voor me kan maken, en dat elk bezoek of elke link wordt vastgelegd. Ik kan dit zelf terugzien en mijn account op elk moment verwijderen.")}
                  </span>
                </label>
              )}

              {error && (
                <p role="alert" className="text-xs" style={{ color: COLORS.red }}>
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="text-xs" style={{ color: COLORS.green }}>
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || (view === "reset" && !resetToken)}
                className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ background: COLORS.gold, color: "#0A0A0A" }}
              >
                {submitLabel}
              </button>

              {view === "login" && mail && (
                <button type="button" onClick={() => switchMode("forgot")} className="text-[11px] text-center" style={linkStyle}>
                  {tr("Wachtwoord vergeten?")}
                </button>
              )}
              {view === "login" && !mail && (
                <p className="text-[11px] text-center" style={linkStyle}>
                  {tr("Wachtwoord kwijt? Vraag je coach om een resetlink.")}
                </p>
              )}
            </>
          )}

          {view === "forgot" && (
            <button type="button" onClick={() => switchMode("login")} className="text-[11px] text-center" style={linkStyle}>
              {tr("Terug naar inloggen")}
            </button>
          )}
          {view === "reset" && !done && (
            <a href="#/journal" className="text-[11px] text-center" style={linkStyle}>
              {tr("Terug naar inloggen")}
            </a>
          )}
        </form>

        {needsSetup && !setup && !resetting && (
          <a href="#/setup" className="text-[11px] text-center" style={linkStyle}>
            {tr("Eerste keer? Beheerder instellen")}
          </a>
        )}
        {setup && (
          <a href="#/journal" className="text-[11px] text-center" style={linkStyle}>
            {tr("Terug naar inloggen")}
          </a>
        )}
      </div>
    </div>
  );
}
