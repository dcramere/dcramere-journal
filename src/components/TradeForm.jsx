import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { COLORS, MOODS, SETUPS } from "../theme.js";
import { storage } from "../storage.js";
import { KNOWN_ROOTS, pointValue } from "../lib/contracts.js";
import { money } from "../lib/format.js";
import { resizeImageFile } from "../lib/image.js";
import { newId, riskDollars } from "../lib/model.js";
import { partsInTz, wallToEpoch } from "../lib/tz.js";
import { Button, Field, Modal, TextInput, inputStyle } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";

const numOrNull = (s) => {
  if (s === "" || s == null) return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function initialState(initial, accounts, defaultAccountId, tz) {
  if (initial) {
    const o = partsInTz(initial.openedAt, tz);
    const c = partsInTz(initial.closedAt, tz);
    const hhmm = (p) => `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
    return {
      accountId: initial.accountId,
      date: c.date,
      openTime: hhmm(o),
      closeTime: hhmm(c),
      symbol: initial.symbol,
      direction: initial.direction,
      qty: String(initial.qty ?? 1),
      entry: initial.entryPrice ?? "",
      exit: initial.exitPrice ?? "",
      fees: initial.fees ? String(initial.fees) : "",
      pnl: String(Number(initial.pnl).toFixed(2)),
      r: initial.r != null ? String(initial.r) : "",
      setup: initial.setup || "",
      mood: initial.mood || "",
      lesson: initial.lesson || "",
    };
  }
  return {
    accountId: defaultAccountId || accounts[0].id,
    date: partsInTz(Date.now(), tz).date,
    openTime: "",
    closeTime: "",
    symbol: "",
    direction: "Long",
    qty: "1",
    entry: "",
    exit: "",
    fees: "",
    pnl: "",
    r: "",
    setup: SETUPS[0],
    mood: "",
    lesson: "",
  };
}

export function TradeForm({ accounts, defaultAccountId, initial, tz, knownSymbols, onSave, onClose }) {
  const [f, setF] = useState(() => initialState(initial, accounts, defaultAccountId, tz));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState(null); // dataURL of null
  const [shotChanged, setShotChanged] = useState(false);
  const fileRef = useRef(null);
  const tradeId = useRef(initial ? initial.id : newId());
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const account = accounts.find((a) => a.id === f.accountId) || accounts[0];

  useEffect(() => {
    if (!initial?.hasScreenshot) return;
    storage
      .get(`screenshot:${initial.id}`, false)
      .then((r) => setShot(r.value))
      .catch(() => setShot(null));
  }, [initial]);

  const suggested = useMemo(() => {
    const entry = numOrNull(f.entry);
    const exit = numOrNull(f.exit);
    const qty = numOrNull(f.qty);
    const mult = pointValue(f.symbol);
    if ([entry, exit, qty].some((x) => x == null || Number.isNaN(x)) || mult == null) return null;
    const gross = (exit - entry) * (f.direction === "Long" ? 1 : -1) * qty * mult;
    const fees = numOrNull(f.fees) ?? (Number(account.commission) || 0) * qty;
    return { gross, fees, net: gross - fees };
  }, [f.entry, f.exit, f.qty, f.symbol, f.direction, f.fees, account.commission]);

  async function onPickFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(tr("Kies een afbeeldingsbestand."));
      return;
    }
    try {
      setShot(await resizeImageFile(file));
      setShotChanged(true);
      setError("");
    } catch (err) {
      setError(tr("Kon de screenshot niet verwerken — probeer een andere afbeelding."));
    }
  }

  async function submit(e) {
    e.preventDefault();
    const symbol = f.symbol.trim().toUpperCase();
    if (!symbol) return setError(tr("Vul een symbool in."));
    const qty = numOrNull(f.qty);
    if (qty == null || Number.isNaN(qty) || qty <= 0) return setError(tr("Aantal moet groter dan 0 zijn."));

    const pnlTyped = numOrNull(f.pnl);
    const r = numOrNull(f.r);
    if (Number.isNaN(pnlTyped) || Number.isNaN(r)) return setError(tr("Resultaat moet een getal zijn."));

    let pnl;
    let fees = numOrNull(f.fees);
    if (Number.isNaN(fees)) return setError(tr("Kosten moeten een getal zijn."));
    if (pnlTyped != null) {
      pnl = pnlTyped;
      fees = fees ?? 0;
    } else if (suggested) {
      pnl = suggested.net;
      fees = suggested.fees;
    } else if (r != null) {
      pnl = r * riskDollars(account, account.startBalance);
      fees = fees ?? 0;
    } else {
      return setError(tr("Vul een resultaat in ($ of R), of entry/exit/aantal van een bekend contract."));
    }

    const [y, mo, d] = f.date.split("-").map(Number);
    if (!y) return setError(tr("Kies een datum."));
    const clock = (s, fallback) => {
      const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
      return m ? [Number(m[1]), Number(m[2])] : fallback;
    };
    const closeClock = clock(f.closeTime, clock(f.openTime, [12, 0]));
    const openClock = clock(f.openTime, closeClock);
    const openedAt = wallToEpoch(y, mo, d, openClock[0], openClock[1], 0, tz);
    const closedAt = wallToEpoch(y, mo, d, closeClock[0], closeClock[1], 0, tz);
    if (closedAt < openedAt) return setError(tr("Sluittijd ligt vóór de opentijd."));

    setBusy(true);
    let hasScreenshot = initial?.hasScreenshot || false;
    if (shotChanged) {
      try {
        if (shot) {
          await storage.set(`screenshot:${tradeId.current}`, shot, false);
          hasScreenshot = true;
        } else {
          await storage.delete(`screenshot:${tradeId.current}`, false).catch(() => {});
          hasScreenshot = false;
        }
      } catch (err) {
        setBusy(false);
        return setError(tr("Screenshot opslaan mislukt (opslag vol?). Probeer zonder screenshot of een kleinere afbeelding."));
      }
    }

    onSave({
      ...(initial || {}),
      id: tradeId.current,
      accountId: f.accountId,
      symbol,
      direction: f.direction,
      qty,
      entryPrice: numOrNull(f.entry),
      exitPrice: numOrNull(f.exit),
      openedAt,
      closedAt,
      pnl,
      fees: fees ?? 0,
      r,
      setup: f.setup,
      mood: f.mood,
      lesson: f.lesson.trim(),
      hasScreenshot,
    });
    setBusy(false);
  }

  const symbols = [...new Set([...(knownSymbols || []), ...KNOWN_ROOTS])];
  const mult = pointValue(f.symbol);

  return (
    <Modal title={initial ? tr("Trade bewerken") : tr("Nieuwe trade loggen")} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {accounts.length > 1 && (
            <Field label={tr("Account")} className="col-span-2 sm:col-span-4">
              <select value={f.accountId} onChange={(e) => set("accountId", e.target.value)} style={inputStyle} className="rounded px-2 py-1.5 text-sm">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={tr("Datum")}>
            <TextInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label={tr("Open (optioneel)")}>
            <TextInput type="time" value={f.openTime} onChange={(e) => set("openTime", e.target.value)} />
          </Field>
          <Field label={tr("Sluit (optioneel)")}>
            <TextInput type="time" value={f.closeTime} onChange={(e) => set("closeTime", e.target.value)} />
          </Field>
          <Field label={tr("Richting")}>
            <div className="flex gap-1">
              {["Long", "Short"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("direction", d)}
                  className="flex-1 rounded px-2 py-1.5 text-xs font-semibold"
                  style={{
                    background: f.direction === d ? (d === "Long" ? COLORS.green : COLORS.red) : COLORS.inputBg,
                    border: `1px solid ${COLORS.cardBorder}`,
                    color: f.direction === d ? "#0A0A0A" : COLORS.textMuted,
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label={tr("Symbool")}>
            <TextInput list="symbol-list" placeholder={tr("MNQ, ES, BTCUSDT")} value={f.symbol} onChange={(e) => set("symbol", e.target.value)} />
            <datalist id="symbol-list">
              {symbols.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label={tr("Aantal contracten")}>
            <TextInput inputMode="decimal" value={f.qty} onChange={(e) => set("qty", e.target.value)} />
          </Field>
          <Field label={tr("Entry")}>
            <TextInput inputMode="decimal" placeholder={tr("optioneel")} value={f.entry} onChange={(e) => set("entry", e.target.value)} />
          </Field>
          <Field label={tr("Exit")}>
            <TextInput inputMode="decimal" placeholder={tr("optioneel")} value={f.exit} onChange={(e) => set("exit", e.target.value)} />
          </Field>
          <Field label={tr("Resultaat ($, netto)")}>
            <TextInput
              inputMode="decimal"
              placeholder={suggested ? tr("auto: {v}", { v: money(suggested.net) }) : tr("bijv. 96.50 of -52")}
              value={f.pnl}
              onChange={(e) => set("pnl", e.target.value)}
            />
          </Field>
          <Field label={tr("Resultaat (R, optioneel)")}>
            <TextInput inputMode="decimal" placeholder={tr("bijv. 1.5 of -1")} value={f.r} onChange={(e) => set("r", e.target.value)} />
          </Field>
          <Field label={tr("Kosten ($, optioneel)")}>
            <TextInput
              inputMode="decimal"
              placeholder={account.commission ? tr("auto: {v}", { v: money((Number(account.commission) || 0) * (Number(f.qty) || 0)) }) : "0.00"}
              value={f.fees}
              onChange={(e) => set("fees", e.target.value)}
            />
          </Field>
          <Field label={tr("Setup")}>
            <select value={f.setup} onChange={(e) => set("setup", e.target.value)} style={inputStyle} className="rounded px-2 py-1.5 text-sm">
              {SETUPS.map((s) => (
                <option key={s} value={s}>
                  {tr(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-[11px] -mt-1" style={{ color: COLORS.textMuted }}>
          {suggested
            ? tr("Berekend uit entry/exit/aantal ({p} per punt): {g} bruto, {n} netto. Laat resultaat leeg om dit te gebruiken.", { p: money(mult, { dec: 2 }), g: money(suggested.gross, { sign: true }), n: money(suggested.net, { sign: true }) })
            : tr("Vul het resultaat in als $ of R. Bij een bekend contract (MNQ, ES, NQ …) met entry, exit en aantal rekent de app het voor je uit.")}
        </p>

        <div>
          <p className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
            {tr("Emotionele toestand vóór de trade (optioneel)")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => {
              const active = f.mood === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("mood", active ? "" : m)}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: active ? COLORS.gold : COLORS.inputBg,
                    border: `1px solid ${COLORS.cardBorder}`,
                    color: active ? "#0A0A0A" : COLORS.textMuted,
                  }}
                >
                  {tr(m)}
                </button>
              );
            })}
          </div>
        </div>

        <Field label={tr("Fout / les (optioneel)")}>
          <textarea
            rows={2}
            value={f.lesson}
            onChange={(e) => set("lesson", e.target.value)}
            style={inputStyle}
            className="rounded px-2 py-1.5 text-sm"
            placeholder={tr("Wat ging goed, wat leer je ervan?")}
          />
        </Field>

        <div>
          <p className="text-xs mb-1" style={{ color: COLORS.textMuted }}>
            {tr("Screenshot")}
          </p>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          {shot ? (
            <div className="relative inline-block rounded overflow-hidden" style={{ border: `1px solid ${COLORS.cardBorder}` }}>
              <img src={shot} alt={tr("Screenshot voorbeeld")} className="block h-24 w-auto" />
              <button
                type="button"
                onClick={() => {
                  setShot(null);
                  setShotChanged(true);
                }}
                className="absolute top-1 right-1 rounded-full p-0.5"
                style={{ background: COLORS.bg, color: COLORS.text }}
                aria-label={tr("Screenshot verwijderen")}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="flex items-center gap-2 rounded px-3 py-2 text-xs"
              style={{ background: COLORS.inputBg, border: `1px dashed ${COLORS.cardBorder}`, color: COLORS.textMuted }}
            >
              <Camera size={14} /> {tr("Screenshot toevoegen")}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs" style={{ color: COLORS.red }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button onClick={onClose}>{tr("Annuleren")}</Button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-50"
            style={{ background: COLORS.gold, color: "#0A0A0A" }}
          >
            {initial ? tr("Opslaan") : tr("Trade loggen")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
