import { setLang, tr } from "../i18n.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "../storage.js";
import { SCHEMA_VERSION, defaultSettings, makeAccount, migrateEntries, newId, tradeKey } from "../lib/model.js";

async function read(key, fallback) {
  try {
    const res = await storage.get(key, false);
    return JSON.parse(res.value);
  } catch (e) {
    return fallback;
  }
}

async function write(key, value) {
  await storage.set(key, JSON.stringify(value), false);
}

// Centrale opslag van accounts, trades en instellingen (localStorage).
export function useJournal() {
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(defaultSettings());
  const [saveError, setSaveError] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const schema = await read("schema", null);
      let acc = await read("accounts", null);
      let trd = await read("trades", null);
      const set = { ...defaultSettings(), ...(await read("settings", {})) };

      setLang(set.lang);
      if (!acc || !acc.length) acc = [makeAccount()];
      if (!trd) {
        trd = [];
        if (schema == null) {
          const legacy = await read("entries", null);
          if (Array.isArray(legacy) && legacy.length) trd = migrateEntries(legacy, acc[0], set.timezone);
        }
      }
      if (set.accountId !== "all" && !acc.some((a) => a.id === set.accountId)) set.accountId = "all";
      if (cancelled) return;
      setAccounts(acc);
      setTrades(trd);
      setSettings(set);
      loaded.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Elke wijziging wordt direct bewaard zodra de eerste lading klaar is.
  useEffect(() => {
    if (!loaded.current) return;
    (async () => {
      try {
        await write("schema", SCHEMA_VERSION);
        await write("accounts", accounts);
        await write("trades", trades);
        await write("settings", settings);
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    })();
  }, [accounts, trades, settings]);

  const addTrade = useCallback((trade) => {
    const full = { id: newId(), source: "manual", fees: 0, ...trade };
    setTrades((list) => [...list, full]);
    return full;
  }, []);

  const updateTrade = useCallback((id, patch) => {
    setTrades((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTrade = useCallback(async (id) => {
    setTrades((list) => list.filter((t) => t.id !== id));
    try {
      await storage.delete(`screenshot:${id}`, false);
    } catch (e) {
      // Geen screenshot voor deze trade.
    }
  }, []);

  const importTrades = useCallback(
    (incoming, meta) => {
      const seen = new Set(trades.map(tradeKey));
      const fresh = [];
      let skipped = 0;
      for (const t of incoming) {
        const key = tradeKey(t);
        if (seen.has(key)) {
          skipped += 1;
        } else {
          seen.add(key);
          fresh.push(t);
        }
      }
      setTrades((list) => [...list, ...fresh]);
      setSettings((s) => ({
        ...s,
        imports: [{ id: newId(), at: Date.now(), added: fresh.length, skipped, ...meta }, ...(s.imports || [])].slice(0, 50),
      }));
      return { added: fresh.length, skipped };
    },
    [trades]
  );

  const addAccount = useCallback((partial) => {
    const account = makeAccount(partial);
    setAccounts((list) => [...list, account]);
    return account;
  }, []);

  const updateAccount = useCallback((id, patch) => {
    setAccounts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const deleteAccount = useCallback(
    async (id) => {
      const doomed = trades.filter((t) => t.accountId === id);
      setTrades((list) => list.filter((t) => t.accountId !== id));
      setAccounts((list) => list.filter((a) => a.id !== id));
      setSettings((s) => (s.accountId === id ? { ...s, accountId: "all" } : s));
      for (const t of doomed) {
        try {
          await storage.delete(`screenshot:${t.id}`, false);
        } catch (e) {
          // Niets te verwijderen.
        }
      }
    },
    [trades]
  );

  const updateSettings = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const resetAll = useCallback(async () => {
    for (const t of trades) {
      try {
        await storage.delete(`screenshot:${t.id}`, false);
      } catch (e) {
        // Niets te verwijderen.
      }
    }
    try {
      await storage.delete("entries", false);
    } catch (e) {
      // Geen oude data.
    }
    setTrades([]);
    setAccounts([makeAccount()]);
    setSettings(defaultSettings());
  }, [trades]);

  const exportBackup = useCallback(async () => {
    const screenshots = {};
    for (const t of trades) {
      if (!t.hasScreenshot) continue;
      try {
        const res = await storage.get(`screenshot:${t.id}`, false);
        screenshots[t.id] = res.value;
      } catch (e) {
        // Screenshot ontbreekt; sla over.
      }
    }
    return { app: "dcramere-journal", version: SCHEMA_VERSION, exportedAt: Date.now(), accounts, trades, settings, screenshots };
  }, [accounts, trades, settings]);

  const restoreBackup = useCallback(async (data) => {
    if (!data || data.app !== "dcramere-journal" || !Array.isArray(data.accounts) || !Array.isArray(data.trades)) {
      throw new Error(tr("Dit is geen geldig DCRAMERE-backupbestand."));
    }
    for (const [id, value] of Object.entries(data.screenshots || {})) {
      try {
        await storage.set(`screenshot:${id}`, value, false);
      } catch (e) {
        // Quota vol: ga door met de rest.
      }
    }
    setAccounts(data.accounts.length ? data.accounts : [makeAccount()]);
    setTrades(data.trades);
    setSettings({ ...defaultSettings(), ...(data.settings || {}), accountId: "all" });
  }, []);

  return {
    ready,
    accounts,
    trades,
    settings,
    saveError,
    addTrade,
    updateTrade,
    deleteTrade,
    importTrades,
    addAccount,
    updateAccount,
    deleteAccount,
    updateSettings,
    resetAll,
    exportBackup,
    restoreBackup,
  };
}
