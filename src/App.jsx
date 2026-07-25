import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, BookOpen, TrendingUp, TrendingDown, Camera, X, Image as ImageIcon } from "lucide-react";
import { storage } from "./storage.js";

const COLORS = {
  bg: "#0A0A0A",
  card: "#141210",
  cardBorder: "#2A241A",
  gold: "#D4AF37",
  goldMuted: "#B8912F",
  text: "#F1ECDD",
  textMuted: "#8C8577",
  green: "#4C9A5B",
  red: "#B8514F",
  inputBg: "#1B1712",
};

const SETUPS = [
  "Snelweg (200)",
  "Invoegstrook (CLD Cross)",
  "Rijstrook (STRAP)",
  "Vangrail (DC)",
  "Verkeerslicht (Confluence)",
  "Afrit / Structuurbreuk",
  "Anders",
];

const ENTRIES_KEY = "entries";
const MAX_SCREENSHOT_WIDTH = 900;
const JPEG_QUALITY = 0.72;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    date: todayISO(),
    symbol: "",
    direction: "Long",
    entryPrice: "",
    exitPrice: "",
    positionSize: "",
    setup: SETUPS[0],
    result: "",
    lesson: "",
  };
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon bestand niet lezen."));
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Kon afbeelding niet laden."));
      img.onload = () => {
        const scale = Math.min(1, MAX_SCREENSHOT_WIDTH / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [pendingScreenshot, setPendingScreenshot] = useState(null);
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotCache, setScreenshotCache] = useState({});
  const [openScreenshotId, setOpenScreenshotId] = useState(null);
  const [screenshotLoadError, setScreenshotLoadError] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get(ENTRIES_KEY, false);
        if (!cancelled && res && res.value) {
          setEntries(JSON.parse(res.value));
        }
      } catch (e) {
        // Nog geen data opgeslagen — begin met een lege journal.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistEntries(next) {
    setEntries(next);
    try {
      const res = await storage.set(ENTRIES_KEY, JSON.stringify(next), false);
      setSaveError(!res);
    } catch (e) {
      setSaveError(true);
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleScreenshotSelect(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Kies een afbeeldingsbestand.");
      return;
    }
    setScreenshotBusy(true);
    setFormError("");
    try {
      const dataUrl = await resizeImageFile(file);
      setPendingScreenshot(dataUrl);
    } catch (err) {
      setFormError("Kon de screenshot niet verwerken — probeer een andere afbeelding.");
    } finally {
      setScreenshotBusy(false);
    }
  }

  function removePendingScreenshot() {
    setPendingScreenshot(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.symbol.trim()) {
      setFormError("Vul een symbool in.");
      return;
    }
    if (form.result === "" || isNaN(Number(form.result))) {
      setFormError("Vul een resultaat in R in (bijv. 1.5 of -1).");
      return;
    }
    setFormError("");

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      date: form.date || todayISO(),
      symbol: form.symbol.trim().toUpperCase(),
      direction: form.direction,
      entryPrice: form.entryPrice,
      exitPrice: form.exitPrice,
      positionSize: form.positionSize.trim(),
      setup: form.setup,
      result: Number(form.result),
      lesson: form.lesson.trim(),
      hasScreenshot: !!pendingScreenshot,
    };

    const next = [entry, ...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
    await persistEntries(next);

    if (pendingScreenshot) {
      try {
        await storage.set(`screenshot:${id}`, pendingScreenshot, false);
        setScreenshotCache((c) => ({ ...c, [id]: pendingScreenshot }));
      } catch (err) {
        // De trade zelf is gelogd; alleen de screenshot kon niet worden opgeslagen.
        setScreenshotLoadError((c) => ({ ...c, [id]: true }));
      }
    }

    setForm(emptyForm());
    setPendingScreenshot(null);
  }

  async function handleDelete(id) {
    const next = entries.filter((e) => e.id !== id);
    await persistEntries(next);
    try {
      await storage.delete(`screenshot:${id}`, false);
    } catch (e) {
      // Geen screenshot aanwezig voor deze trade — niets te verwijderen.
    }
    setScreenshotCache((c) => {
      const copy = { ...c };
      delete copy[id];
      return copy;
    });
    if (openScreenshotId === id) setOpenScreenshotId(null);
  }

  async function toggleScreenshot(id) {
    if (openScreenshotId === id) {
      setOpenScreenshotId(null);
      return;
    }
    setOpenScreenshotId(id);
    if (screenshotCache[id]) return;
    try {
      const res = await storage.get(`screenshot:${id}`, false);
      if (res && res.value) {
        setScreenshotCache((c) => ({ ...c, [id]: res.value }));
      }
    } catch (e) {
      setScreenshotLoadError((c) => ({ ...c, [id]: true }));
    }
  }

  const stats = useMemo(() => {
    const total = entries.length;
    if (total === 0) {
      return { total: 0, winRate: "—", avgR: "—", netR: "0.00" };
    }
    const wins = entries.filter((e) => Number(e.result) > 0).length;
    const sum = entries.reduce((acc, e) => acc + Number(e.result), 0);
    return {
      total,
      winRate: `${Math.round((wins / total) * 100)}%`,
      avgR: (sum / total).toFixed(2),
      netR: sum.toFixed(2),
    };
  }, [entries]);

  const inputStyle = {
    background: COLORS.inputBg,
    border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text,
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text }} className="font-sans">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <BookOpen size={22} color={COLORS.gold} />
          <h1
            style={{ fontFamily: "Georgia, serif", color: COLORS.gold, letterSpacing: "0.04em" }}
            className="text-xl sm:text-2xl font-bold"
          >
            DCRAMERE JOURNAL
          </h1>
        </div>
        <div style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }} className="pb-3 mb-6">
          <p style={{ color: COLORS.textMuted }} className="text-xs tracking-widest">
            SEE · DECIPHER · TRADE
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Trades", value: stats.total },
            { label: "Win rate", value: stats.winRate },
            { label: "Gem. R", value: stats.avgR },
            { label: "Netto R", value: stats.netR },
          ].map((s) => (
            <div
              key={s.label}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
              className="rounded-lg px-3 py-3 text-center"
            >
              <div style={{ color: COLORS.gold }} className="text-lg sm:text-xl font-bold">
                {s.value}
              </div>
              <div style={{ color: COLORS.textMuted }} className="text-[11px] uppercase tracking-wide mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
          className="rounded-lg p-4 sm:p-5 mb-8"
        >
          <h2 style={{ color: COLORS.text }} className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plus size={16} color={COLORS.gold} />
            Nieuwe trade loggen
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Datum
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Symbool
              <input
                type="text"
                placeholder="BTCUSDT"
                value={form.symbol}
                onChange={(e) => updateField("symbol", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Richting
              <div className="flex gap-1">
                {["Long", "Short"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateField("direction", d)}
                    style={{
                      background: form.direction === d ? (d === "Long" ? COLORS.green : COLORS.red) : COLORS.inputBg,
                      border: `1px solid ${COLORS.cardBorder}`,
                      color: form.direction === d ? "#0A0A0A" : COLORS.textMuted,
                    }}
                    className="flex-1 rounded px-2 py-1.5 text-xs font-semibold"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Entry
              <input
                type="text"
                inputMode="decimal"
                placeholder="optioneel"
                value={form.entryPrice}
                onChange={(e) => updateField("entryPrice", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Exit
              <input
                type="text"
                inputMode="decimal"
                placeholder="optioneel"
                value={form.exitPrice}
                onChange={(e) => updateField("exitPrice", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Positiegrootte
              <input
                type="text"
                placeholder="bijv. 0.5 BTC, 1%"
                value={form.positionSize}
                onChange={(e) => updateField("positionSize", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Resultaat (R)
              <input
                type="text"
                inputMode="decimal"
                placeholder="bijv. 1.5 of -1"
                value={form.result}
                onChange={(e) => updateField("result", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Reden (Handelsweg-stap)
              <select
                value={form.setup}
                onChange={(e) => updateField("setup", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              >
                {SETUPS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.textMuted }}>
              Fout / les
              <input
                type="text"
                placeholder="optioneel"
                value={form.lesson}
                onChange={(e) => updateField("lesson", e.target.value)}
                style={inputStyle}
                className="rounded px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {/* Screenshot */}
          <div className="mb-3">
            <p className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
              Screenshot
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotSelect}
              className="hidden"
            />
            {pendingScreenshot ? (
              <div
                style={{ border: `1px solid ${COLORS.cardBorder}` }}
                className="relative inline-block rounded overflow-hidden"
              >
                <img src={pendingScreenshot} alt="Screenshot preview" className="block h-24 w-auto" />
                <button
                  type="button"
                  onClick={removePendingScreenshot}
                  style={{ background: COLORS.bg, color: COLORS.text }}
                  className="absolute top-1 right-1 rounded-full p-0.5 opacity-90"
                  aria-label="Screenshot verwijderen"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                disabled={screenshotBusy}
                style={{
                  background: COLORS.inputBg,
                  border: `1px dashed ${COLORS.cardBorder}`,
                  color: COLORS.textMuted,
                }}
                className="flex items-center gap-2 rounded px-3 py-2 text-xs"
              >
                <Camera size={14} />
                {screenshotBusy ? "Bezig met verwerken…" : "Screenshot toevoegen"}
              </button>
            )}
          </div>

          {formError && (
            <p style={{ color: COLORS.red }} className="text-xs mb-2">
              {formError}
            </p>
          )}
          {saveError && (
            <p style={{ color: COLORS.red }} className="text-xs mb-2">
              Opslaan is mislukt — probeer het nog eens.
            </p>
          )}

          <button
            type="submit"
            style={{ background: COLORS.gold, color: "#0A0A0A" }}
            className="w-full sm:w-auto rounded px-4 py-2 text-sm font-bold"
          >
            Trade loggen
          </button>
        </form>

        {/* Entries */}
        <h2 style={{ color: COLORS.text }} className="text-sm font-semibold mb-3">
          Trades {loading ? "" : `(${entries.length})`}
        </h2>

        {loading ? (
          <p style={{ color: COLORS.textMuted }} className="text-sm">
            Journal laden…
          </p>
        ) : entries.length === 0 ? (
          <div
            style={{ background: COLORS.card, border: `1px dashed ${COLORS.cardBorder}`, color: COLORS.textMuted }}
            className="rounded-lg p-6 text-center text-sm"
          >
            Nog geen trades gelogd. Log je eerste trade hierboven.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => {
              const win = Number(entry.result) > 0;
              const screenshotOpen = openScreenshotId === entry.id;
              return (
                <div
                  key={entry.id}
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
                  className="rounded-lg p-3 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        style={{ background: win ? COLORS.green : COLORS.red }}
                        className="inline-block w-2 h-2 rounded-full"
                      />
                      <span style={{ color: COLORS.text }} className="font-semibold text-sm">
                        {entry.symbol}
                      </span>
                      <span
                        style={{
                          color: entry.direction === "Long" ? COLORS.green : COLORS.red,
                          border: `1px solid ${COLORS.cardBorder}`,
                        }}
                        className="text-[11px] px-1.5 py-0.5 rounded uppercase font-semibold"
                      >
                        {entry.direction}
                      </span>
                      <span style={{ color: COLORS.textMuted }} className="text-xs">
                        {entry.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {win ? (
                          <TrendingUp size={14} color={COLORS.green} />
                        ) : (
                          <TrendingDown size={14} color={COLORS.red} />
                        )}
                        <span
                          style={{ color: win ? COLORS.green : COLORS.red }}
                          className="text-sm font-bold"
                        >
                          {Number(entry.result) > 0 ? "+" : ""}
                          {entry.result}R
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        aria-label="Trade verwijderen"
                        style={{ color: COLORS.textMuted }}
                        className="hover:opacity-100 opacity-60"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div style={{ color: COLORS.textMuted }} className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {(entry.entryPrice || entry.exitPrice) && (
                      <span>
                        {entry.entryPrice || "—"} → {entry.exitPrice || "—"}
                      </span>
                    )}
                    {entry.positionSize && <span>Grootte: {entry.positionSize}</span>}
                    <span>{entry.setup}</span>
                  </div>

                  {entry.lesson && (
                    <p style={{ color: COLORS.text }} className="text-xs mt-2 italic">
                      {entry.lesson}
                    </p>
                  )}

                  {entry.hasScreenshot && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleScreenshot(entry.id)}
                        style={{ color: COLORS.gold }}
                        className="flex items-center gap-1 text-xs font-semibold"
                      >
                        <ImageIcon size={13} />
                        {screenshotOpen ? "Screenshot verbergen" : "Screenshot bekijken"}
                      </button>
                      {screenshotOpen && (
                        <div className="mt-2">
                          {screenshotLoadError[entry.id] ? (
                            <p style={{ color: COLORS.red }} className="text-xs">
                              Screenshot kon niet worden geladen.
                            </p>
                          ) : screenshotCache[entry.id] ? (
                            <img
                              src={screenshotCache[entry.id]}
                              alt={`Screenshot ${entry.symbol}`}
                              style={{ border: `1px solid ${COLORS.cardBorder}` }}
                              className="rounded max-w-full sm:max-w-md"
                            />
                          ) : (
                            <p style={{ color: COLORS.textMuted }} className="text-xs">
                              Laden…
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
