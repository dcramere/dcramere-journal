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

// Inloggen en account maken. Met `setup` meldt de eerste beheerder zich aan (setup-code uit Vercel).
export function AuthScreen({ lang, onLang, onAuthed, setup = false, needsSetup = false }) {
  const [tab, setTab] = useState(setup ? "register" : "login");
  const [f, setF] = useState({ name: "", email: "", password: "", token: "", consent: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const registering = setup || tab === "register";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = registering
        ? { email: f.email.trim(), password: f.password, name: f.name.trim(), lang, ...(setup ? { setupToken: f.token.trim() } : { consent: f.consent }) }
        : { email: f.email.trim(), password: f.password };
      const { user } = await api.post(registering ? "/api/auth/register" : "/api/auth/login", body);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
          {setup ? (
            <h2 className="text-sm font-semibold">{tr("Beheerder instellen")}</h2>
          ) : (
            <Segmented
              value={tab}
              onChange={(v) => {
                setTab(v);
                setError("");
              }}
              ariaLabel={tr("Inloggen of account maken")}
              options={[
                { value: "login", label: "Inloggen" },
                { value: "register", label: "Account maken" },
              ]}
            />
          )}

          {registering && <Input label={tr("Naam")} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required maxLength={80} />}
          <Input label={tr("E-mailadres")} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
          <Input
            label={registering ? tr("Wachtwoord (minimaal 10 tekens)") : tr("Wachtwoord")}
            type="password"
            value={f.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete={registering ? "new-password" : "current-password"}
            required
            minLength={registering ? 10 : undefined}
          />
          {registering && setup && (
            <Input label={tr("Setup-code (uit Vercel)")} type="password" value={f.token} onChange={(e) => set("token", e.target.value)} required autoComplete="off" />
          )}
          {registering && !setup && (
            <label className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
              <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5" required />
              <span>
                {tr("Ik begrijp dat de beheerder (mijn coach) mijn journal kan bekijken, alleen lezen, en dat elk bezoek wordt vastgelegd. Ik kan dit zelf terugzien en mijn account op elk moment verwijderen.")}
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="text-xs" style={{ color: COLORS.red }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ background: COLORS.gold, color: "#0A0A0A" }}
          >
            {busy ? tr("Bezig…") : setup ? tr("Beheerder aanmaken") : registering ? tr("Account maken") : tr("Inloggen")}
          </button>
        </form>

        {needsSetup && !setup && (
          <a href="#/setup" className="text-[11px] text-center" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
            {tr("Eerste keer? Beheerder instellen")}
          </a>
        )}
        {setup && (
          <a href="#/journal" className="text-[11px] text-center" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
            {tr("Terug naar inloggen")}
          </a>
        )}
      </div>
    </div>
  );
}
