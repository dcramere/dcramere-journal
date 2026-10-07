import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api.js";
import { setLang, tr } from "../i18n.js";
import { defaultSettings, makeAccount, newId, tradeKey } from "../lib/model.js";

const CHUNK = 500;

// Zelfde interface als useJournal (lokaal), maar de data staat op de server.
// Met `userId` bekijkt de beheerder het journal van een klant: alleen lezen.
export function useRemoteJournal({ userId = null } = {}) {
  const readOnly = Boolean(userId);
  const base = readOnly ? `/api/admin/users/${userId}/data` : "/api/data";
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [owner, setOwner] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(defaultSettings());
  const [saveError, setSaveError] = useState(false);
  const live = useRef({ accounts, trades, settings });
  live.current = { accounts, trades, settings };
  const timers = useRef({});

  const load = useCallback(async () => {
    try {
      const data = await api.get(base);
      const set = { ...defaultSettings(), ...data.settings };
      if (!set.lang) set.lang = defaultSettings().lang;
      // De beheerder houdt zijn eigen taal, ook als hij het journal van een klant bekijkt.
      if (!readOnly) setLang(set.lang);
      let acc = data.accounts;
      if (set.accountId !== "all" && !acc.some((a) => a.id === set.accountId)) set.accountId = "all";
      if (!readOnly && acc.length === 0) {
        const first = makeAccount();
        acc = [first];
        await api.put(`/api/accounts/${first.id}`, first);
      }
      setOwner(data.user);
      setAccounts(acc);
      setTrades(data.trades);
      setSettings(set);
      setLoadError(null);
      setReady(true);
    } catch (e) {
      setLoadError(e);
    }
  }, [base, readOnly]);

  useEffect(() => {
    setReady(false);
    load();
    return () => Object.values(timers.current).forEach(clearTimeout);
  }, [load]);

  // Voert een schrijfactie uit; bij een fout wordt de lokale staat met de server gelijkgetrokken.
  const persist = useCallback(
    async (fn) => {
      if (readOnly) return undefined;
      try {
        const out = await fn();
        setSaveError(false);
        return out;
      } catch (e) {
        setSaveError(true);
        if (!(e instanceof ApiError && e.status === 401)) await load();
        throw e;
      }
    },
    [readOnly, load]
  );
  const quiet = (p) => p.catch(() => {});

  const addTrade = useCallback(
    async (trade) => {
      const full = { id: newId(), source: "manual", fees: 0, ...trade };
      if (readOnly) return full;
      setTrades((list) => [...list, full]);
      await persist(() => api.put(`/api/trades/${full.id}`, full));
      return full;
    },
    [readOnly, persist]
  );

  const updateTrade = useCallback(
    async (id, patch) => {
      const current = live.current.trades.find((t) => t.id === id);
      if (readOnly || !current) return;
      const next = { ...current, ...patch };
      setTrades((list) => list.map((t) => (t.id === id ? next : t)));
      await persist(() => api.put(`/api/trades/${id}`, next));
    },
    [readOnly, persist]
  );

  const deleteTrade = useCallback(
    async (id) => {
      if (readOnly) return;
      setTrades((list) => list.filter((t) => t.id !== id));
      await quiet(persist(() => api.del(`/api/trades/${id}`)));
    },
    [readOnly, persist]
  );

  const updateSettings = useCallback(
    (patch) => {
      setSettings((s) => ({ ...s, ...patch }));
      if (readOnly) return;
      clearTimeout(timers.current.settings);
      timers.current.settings = setTimeout(() => quiet(persist(() => api.put("/api/settings", live.current.settings))), 500);
    },
    [readOnly, persist]
  );

  const importTrades = useCallback(
    (incoming, meta) => {
      const seen = new Set(live.current.trades.map(tradeKey));
      const fresh = [];
      let skipped = 0;
      for (const t of incoming) {
        const key = tradeKey(t);
        if (seen.has(key)) skipped += 1;
        else {
          seen.add(key);
          fresh.push(t);
        }
      }
      if (readOnly) return { added: 0, skipped };
      setTrades((list) => [...list, ...fresh]);
      updateSettings({
        imports: [{ id: newId(), at: Date.now(), added: fresh.length, skipped, ...meta }, ...(live.current.settings.imports || [])].slice(0, 50),
      });
      quiet(
        persist(async () => {
          for (let i = 0; i < fresh.length; i += CHUNK) await api.post("/api/trades/bulk", { trades: fresh.slice(i, i + CHUNK) });
        })
      );
      return { added: fresh.length, skipped };
    },
    [readOnly, persist, updateSettings]
  );

  const saveAccountSoon = useCallback(
    (id) => {
      clearTimeout(timers.current[`acc:${id}`]);
      timers.current[`acc:${id}`] = setTimeout(() => {
        const account = live.current.accounts.find((a) => a.id === id);
        if (account && account.name.trim()) quiet(persist(() => api.put(`/api/accounts/${id}`, account)));
      }, 400);
    },
    [persist]
  );

  const addAccount = useCallback(
    (partial) => {
      const account = makeAccount(partial);
      if (readOnly) return account;
      setAccounts((list) => [...list, account]);
      quiet(persist(() => api.put(`/api/accounts/${account.id}`, account)));
      return account;
    },
    [readOnly, persist]
  );

  const updateAccount = useCallback(
    (id, patch) => {
      if (readOnly) return;
      setAccounts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      saveAccountSoon(id);
    },
    [readOnly, saveAccountSoon]
  );

  const deleteAccount = useCallback(
    async (id) => {
      if (readOnly) return;
      setTrades((list) => list.filter((t) => t.accountId !== id));
      setAccounts((list) => list.filter((a) => a.id !== id));
      setSettings((s) => (s.accountId === id ? { ...s, accountId: "all" } : s));
      await quiet(persist(() => api.del(`/api/accounts/${id}`)));
    },
    [readOnly, persist]
  );

  const resetAll = useCallback(async () => {
    if (readOnly) return;
    await persist(() => api.del("/api/me/data"));
    const first = makeAccount();
    const fresh = { ...defaultSettings(), lang: live.current.settings.lang };
    setTrades([]);
    setAccounts([first]);
    setSettings(fresh);
    await quiet(persist(() => api.put(`/api/accounts/${first.id}`, first)));
    await quiet(persist(() => api.put("/api/settings", fresh)));
  }, [readOnly, persist]);

  const exportBackup = useCallback(() => api.get("/api/me/export"), []);

  const restoreBackup = useCallback(
    async (data) => {
      if (readOnly) return;
      if (!data || data.app !== "dcramere-journal" || !Array.isArray(data.accounts) || !Array.isArray(data.trades)) {
        throw new Error(tr("Dit is geen geldig DCRAMERE-backupbestand."));
      }
      await api.del("/api/me/data");
      await api.post("/api/import", { accounts: data.accounts, settings: data.settings });
      for (let i = 0; i < data.trades.length; i += CHUNK) await api.post("/api/import", { trades: data.trades.slice(i, i + CHUNK) });
      for (const [id, value] of Object.entries(data.screenshots || {})) await quiet(api.put(`/api/screenshots/${encodeURIComponent(id)}`, { data: value }));
      await load();
    },
    [readOnly, load]
  );

  return {
    mode: "server",
    readOnly,
    owner,
    ready,
    loadError,
    reload: load,
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
