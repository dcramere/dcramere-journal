import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { COLORS } from "../theme.js";
import { tr } from "../i18n.js";
import { setLang } from "../i18n.js";
import { DEFAULT_TZ, makeAccount, migrateEntries } from "../lib/model.js";
import { storage } from "../storage.js";
import { Button, Card } from "../ui/primitives.jsx";

const CHUNK = 500;
const flagKey = (userId) => `dcramere-journal-migrated:${userId}`;

async function readLocal() {
  const read = async (k) => {
    try {
      return JSON.parse((await storage.get(k, false)).value);
    } catch {
      return null;
    }
  };
  const trades = await read("trades");
  if (Array.isArray(trades) && trades.length) return { accounts: (await read("accounts")) || [], trades };
  const legacy = await read("entries");
  if (Array.isArray(legacy) && legacy.length) {
    const account = makeAccount();
    return { accounts: [account], trades: migrateEntries(legacy, account, DEFAULT_TZ) };
  }
  return null;
}

// Biedt aan om een bestaand lokaal journal (uit deze browser) in het account te zetten.
export function MigrateLocal({ user, journal }) {
  const [local, setLocal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    try {
      if (localStorage.getItem(flagKey(user.id))) return undefined;
    } catch {
      return undefined;
    }
    readLocal().then((l) => live && setLocal(l));
    return () => {
      live = false;
    };
  }, [user.id]);

  if (!local) return null;
  const done = () => {
    try {
      localStorage.setItem(flagKey(user.id), "1");
    } catch {
      // Zonder opslag blijft de melding terugkomen; dat is acceptabel.
    }
    setLocal(null);
  };

  async function run() {
    setBusy(true);
    setError("");
    try {
      const keep = new Set(local.accounts.map((a) => a.id));
      const emptyServerAccounts = journal.accounts.filter((a) => !keep.has(a.id) && !journal.trades.some((t) => t.accountId === a.id));
      if (local.accounts.length) await api.post("/api/import", { accounts: local.accounts });
      for (let i = 0; i < local.trades.length; i += CHUNK) await api.post("/api/import", { trades: local.trades.slice(i, i + CHUNK) });
      for (const t of local.trades) {
        if (!t.hasScreenshot) continue;
        try {
          const shot = (await storage.get(`screenshot:${t.id}`, false)).value;
          await api.put(`/api/screenshots/${encodeURIComponent(t.id)}`, { data: shot });
        } catch {
          // Een ontbrekende screenshot mag de import niet stoppen.
        }
      }
      for (const a of emptyServerAccounts) await api.del(`/api/accounts/${a.id}`);
      done();
      await journal.reload();
      setLang(journal.settings.lang);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4" style={{ border: `1px solid ${COLORS.gold}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: COLORS.text }}>
        {tr("Lokaal journal gevonden")}
      </p>
      <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
        {tr("In deze browser staan {n} trades uit de oude, lokale versie. Zet ze in je account zodat je ze overal terugziet.", { n: local.trades.length })}
      </p>
      {error && (
        <p role="alert" className="text-xs mb-2" style={{ color: COLORS.red }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          style={{ background: COLORS.gold, color: "#0A0A0A" }}
        >
          {busy ? tr("Bezig…") : tr("Importeren in mijn account")}
        </button>
        <Button onClick={done} disabled={busy}>
          {tr("Niet nu")}
        </Button>
      </div>
    </Card>
  );
}
