import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, LogOut } from "lucide-react";
import { api, setUnauthorizedHandler } from "./api.js";
import { AuthScreen } from "./auth/AuthScreen.jsx";
import { COLORS, MONO } from "./theme.js";
import { detectLang, setLang, tr } from "./i18n.js";
import { parseRoute } from "./route.js";
import { configureShots } from "./shots.js";
import { useJournal } from "./state/useJournal.js";
import { useRemoteJournal } from "./state/useRemoteJournal.js";
import { AdminView } from "./views/AdminView.jsx";
import JournalApp from "./JournalApp.jsx";
import { Segmented } from "./ui/primitives.jsx";

const LANG_KEY = "dcramere-journal-lang";

function readLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "nl" || stored === "en") return stored;
  } catch {
    // Opslag niet beschikbaar: val terug op de browsertaal.
  }
  return detectLang();
}

function Splash({ children }) {
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.textMuted }} className="flex flex-col gap-3 items-center justify-center text-sm px-6 text-center">
      {children}
    </div>
  );
}

// Wacht tot het journal geladen is; toont een fout met opnieuw proberen.
function Gate({ journal, onLogout, children }) {
  if (journal.ready) return children;
  if (journal.loadError) {
    return (
      <Splash>
        <p style={{ color: COLORS.red }}>{journal.loadError.message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={journal.reload} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: COLORS.gold, color: "#0A0A0A" }}>
            {tr("Opnieuw proberen")}
          </button>
          {onLogout && (
            <button type="button" onClick={onLogout} className="rounded-lg px-3 py-1.5 text-xs" style={{ border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}>
              {tr("Uitloggen")}
            </button>
          )}
        </div>
      </Splash>
    );
  }
  return <Splash>{tr("Journal laden…")}</Splash>;
}

function LocalApp({ tab, onLang, lang }) {
  const journal = useJournal();
  configureShots({ kind: "local" });
  return (
    <Gate journal={journal}>
      <JournalApp journal={journal} tab={tab} basePath="" onLang={onLang} rootLang={lang} />
    </Gate>
  );
}

function OwnApp({ user, tab, onLogout, onLang, lang }) {
  const journal = useRemoteJournal();
  configureShots({ kind: "server" });
  return (
    <Gate journal={journal} onLogout={onLogout}>
      <JournalApp
        journal={journal}
        user={user}
        isAdmin={user.role === "admin"}
        tab={tab}
        basePath=""
        onLogout={onLogout}
        onLang={onLang}
        rootLang={lang}
        onAccountDeleted={onLogout}
      />
    </Gate>
  );
}

// De beheerder bekijkt het journal van een klant: alleen lezen.
function ClientApp({ user, clientId, tab, onLogout, onLang, lang }) {
  const journal = useRemoteJournal({ userId: clientId });
  configureShots({ kind: "admin", userId: clientId });
  const owner = journal.owner;
  return (
    <Gate journal={journal} onLogout={onLogout}>
      <JournalApp
        journal={journal}
        user={user}
        isAdmin
        readOnly
        tab={tab}
        basePath={`#/admin/user/${clientId}`.replace(/^#/, "")}
        banner={owner ? tr("Je bekijkt het journal van {name} ({email}). Alleen lezen.", { name: owner.name, email: owner.email }) : null}
        onLogout={onLogout}
        onLang={onLang}
        rootLang={lang}
      />
    </Gate>
  );
}

function AdminShell({ user, onLogout, lang, onLang }) {
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text }} className="font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen size={22} color={COLORS.gold} />
            <h1 style={{ fontFamily: "Georgia, serif", color: COLORS.gold, letterSpacing: "0.04em" }} className="text-lg min-[380px]:text-xl sm:text-2xl font-bold truncate">
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
        </header>
        <div style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }} className="pb-3 mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p style={{ color: COLORS.textMuted }} className="text-xs tracking-widest">
            {tr("BEHEERDER")} · {tr("Klanten")}
          </p>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
            <a href="#/journal" style={{ color: COLORS.gold }}>
              {tr("Mijn journal")}
            </a>
            <button type="button" onClick={onLogout} className="inline-flex items-center gap-1">
              <LogOut size={12} /> {tr("Uitloggen")}
            </button>
          </div>
        </div>
        <AdminView currentUserId={user.id} />
      </div>
    </div>
  );
}

export default function App() {
  const [lang, setLangState] = useState(readLang);
  const [boot, setBoot] = useState({ status: "loading" });
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(parseRoute);
  setLang(lang);

  const onLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Taalkeuze wordt dan niet onthouden; de app blijft werken.
    }
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Bepaal of de server (database + login) beschikbaar is; zo niet blijft de lokale modus.
  useEffect(() => {
    let alive = true;
    (async () => {
      let health = null;
      try {
        const res = await fetch("/api/health", { credentials: "same-origin" });
        if (res.ok && (res.headers.get("content-type") || "").includes("json")) health = await res.json();
      } catch {
        // Geen API bereikbaar: lokale modus.
      }
      if (!alive) return;
      if (!health || !health.configured) return setBoot({ status: "local" });
      if (!health.ready) return setBoot({ status: "notready" });
      try {
        const { user: me } = await api.get("/api/auth/me");
        if (alive) setUser(me);
      } catch {
        // Niet ingelogd.
      }
      if (alive) setBoot({ status: "server", needsSetup: health.needsSetup, mail: Boolean(health.mail) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // De cookie wordt hoe dan ook lokaal genegeerd na het wissen van de gebruiker.
    }
    setUser(null);
    window.location.hash = "/journal";
  }, []);

  const authed = useCallback((me) => {
    setUser(me);
    setBoot((b) => ({ ...b, needsSetup: false }));
    window.location.hash = "/journal";
  }, []);

  const adminRoute = useMemo(() => route.name === "admin" || route.name === "client", [route.name]);

  if (boot.status === "loading") return <Splash>{tr("Journal laden…")}</Splash>;
  if (boot.status === "notready") {
    return (
      <Splash>
        <p style={{ color: COLORS.red }}>{tr("De database is gekoppeld, maar nog niet klaar. Voer de migraties uit (zie README) en probeer het opnieuw.")}</p>
      </Splash>
    );
  }
  if (boot.status === "local") return <LocalApp tab={route.name === "own" ? route.tab : "journal"} onLang={onLang} lang={lang} />;

  // De link uit de e-mail: werkt ook als je (nog) ingelogd bent.
  if (route.name === "reset") {
    return <AuthScreen key={`reset-${route.token}`} lang={lang} onLang={onLang} onAuthed={authed} resetToken={route.token} mail={boot.mail} />;
  }

  if (!user) {
    const setup = route.name === "setup";
    return <AuthScreen key={setup ? "setup" : "login"} lang={lang} onLang={onLang} onAuthed={authed} setup={setup} needsSetup={boot.needsSetup} mail={boot.mail} />;
  }

  if (adminRoute && user.role !== "admin") {
    window.location.hash = "/journal";
    return null;
  }
  if (route.name === "admin") return <AdminShell user={user} onLogout={logout} lang={lang} onLang={onLang} />;
  if (route.name === "client") {
    return <ClientApp key={route.id} user={user} clientId={route.id} tab={route.tab} onLogout={logout} onLang={onLang} lang={lang} />;
  }
  return <OwnApp key={user.id} user={user} tab={route.name === "own" ? route.tab : "journal"} onLogout={logout} onLang={onLang} lang={lang} />;
}
