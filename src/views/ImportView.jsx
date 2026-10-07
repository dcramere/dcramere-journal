import { getLang } from "../i18n.js";
import { Rich } from "../ui/Rich.jsx";
import React, { useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { COLORS, MONO } from "../theme.js";
import { importCsv } from "../lib/csv.js";
import { money } from "../lib/format.js";
import { ACCOUNT_TYPES, newId } from "../lib/model.js";
import { TIMEZONES, todayInTz } from "../lib/tz.js";
import { Button, Card, Field, Segmented, Select, TextInput } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";

function Collapse({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: `1px solid ${COLORS.grid}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-2.5 text-xs font-semibold"
        style={{ color: COLORS.text }}
      >
        {title}
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", color: COLORS.textMuted }} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

// Getalveld dat pas bij blur/enter wordt doorgegeven, zodat "0." typen niet breekt.
function NumField({ label, value, onCommit, suffix, min }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Number(text.replace(",", "."));
    if (Number.isFinite(n) && (min == null || n >= min)) onCommit(n);
    else setText(String(value));
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <TextInput
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full"
        />
        {suffix && <span style={{ color: COLORS.textMuted }}>{suffix}</span>}
      </div>
    </Field>
  );
}

function AccountSettings({ account, onUpdate, onDelete, tradeCount }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("Naam")}>
          <TextInput value={account.name} onChange={(e) => onUpdate({ name: e.target.value })} />
        </Field>
        <Field label={tr("Broker")}>
          <TextInput value={account.broker} onChange={(e) => onUpdate({ broker: e.target.value })} />
        </Field>
        <NumField label={tr("Startsaldo ($)")} value={account.startBalance} min={0} onCommit={(n) => onUpdate({ startBalance: n })} />
        <NumField label={tr("Commissie per contract ($, round turn)")} value={account.commission} min={0} onCommit={(n) => onUpdate({ commission: n })} />
      </div>
      <Field label={tr("Type account")}>
        <Segmented size="sm" value={account.type} onChange={(type) => onUpdate({ type })} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))} ariaLabel={tr("Type account")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("Gepland risico per trade")}>
          <Segmented size="sm" value={account.riskUnit} onChange={(riskUnit) => onUpdate({ riskUnit })} options={[{ value: "%", label: "%" }, { value: "$", label: "$" }]} ariaLabel={tr("Risico-eenheid")} />
        </Field>
        <NumField label={tr("Risico ({u})", { u: account.riskUnit })} value={account.riskValue} min={0} onCommit={(n) => onUpdate({ riskValue: n })} />
      </div>
      <Field label={tr("Risicomodus")}>
        <Segmented
          size="sm"
          value={account.riskMode}
          onChange={(riskMode) => onUpdate({ riskMode })}
          options={[{ value: "FIXED", label: "Vast risico" }, { value: "COMPOUNDING", label: "Samengesteld" }]}
          ariaLabel={tr("Risicomodus")}
        />
      </Field>
      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        {account.riskMode === "COMPOUNDING"
          ? tr("Het risico wordt het opgegeven percentage van je huidige saldo en groeit mee met het account.")
          : tr("Het risico blijft vast: het percentage telt over je startsaldo. R en % worden hiermee berekend.")}
      </p>
      <div>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm(tr("Account \"{name}\" en zijn {n} trades definitief verwijderen?", { name: account.name, n: tradeCount }))) onDelete();
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Trash2 size={12} /> {tr("Account verwijderen")}
          </span>
        </Button>
      </div>
    </div>
  );
}

function Adjustments({ account, tz, onUpdate }) {
  const [date, setDate] = useState(todayInTz(tz));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const list = [...(account.adjustments || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const add = () => {
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n === 0 || !date) return;
    onUpdate({ adjustments: [...(account.adjustments || []), { id: newId(), date, amount: n, note: note.trim() }] });
    setAmount("");
    setNote("");
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        {tr("Stortingen (+) en opnames (−) tellen mee in je saldo maar niet in je trade-resultaat.")}
      </p>
      {list.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-xs gap-2">
          <span style={{ color: COLORS.textMuted, fontFamily: MONO }}>{a.date}</span>
          <span className="flex-1 truncate" style={{ color: COLORS.textMuted }}>{a.note}</span>
          <span className="font-semibold" style={{ color: a.amount >= 0 ? COLORS.green : COLORS.red, fontFamily: MONO }}>
            {money(a.amount, { sign: true })}
          </span>
          <button type="button" aria-label={tr("Verwijderen")} onClick={() => onUpdate({ adjustments: account.adjustments.filter((x) => x.id !== a.id) })} style={{ color: COLORS.textMuted }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <Field label={tr("Datum")}>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={tr("Bedrag ($, + of −)")}>
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-500" />
        </Field>
        <Field label={tr("Notitie")}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button onClick={add}>{tr("Toevoegen")}</Button>
      </div>
    </div>
  );
}

function AccountCard({ account, tradeCount, balance, tz, onImportFile, onUpdate, onDelete }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [fileTz, setFileTz] = useState(tz);
  const fileRef = useRef(null);

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await onImportFile(account, file, fileTz);
      setMessage({ ok: true, ...res });
    } catch (err) {
      setMessage({ ok: false, text: err.message || tr("Importeren mislukt.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>
            {account.name}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: COLORS.green }}>
            {money(balance)}
          </div>
          <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            {tradeCount} {tradeCount === 1 ? "trade" : "trades"} · {account.broker}
          </div>
        </div>
        <span className="text-[9px] tracking-widest rounded px-1.5 py-0.5" style={{ color: COLORS.gold, border: `1px solid ${COLORS.gold}`, fontFamily: MONO }}>
          {account.type}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files && e.dataTransfer.files[0]);
        }}
        className="mt-3 rounded-lg p-4 flex flex-wrap items-center justify-center gap-2 text-xs"
        style={{ border: `1px dashed ${drag ? COLORS.gold : COLORS.cardBorder}`, background: drag ? COLORS.goldSoft : COLORS.inputBg, color: COLORS.textMuted }}
      >
        <Upload size={14} />
        <span>{tr("Sleep je orderhistorie hierheen, of")}</span>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { handle(e.target.files[0]); e.target.value = ""; }} />
        <Button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
          {busy ? tr("Bezig…") : tr("Kies een bestand")}
        </Button>
      </div>

      {message && (
        <div className="mt-2 text-xs" role="status" style={{ color: message.ok ? COLORS.green : COLORS.red }}>
          {message.ok ? (
            <>
              {message.format}: {tr(message.added === 1 ? "{n} nieuwe trade" : "{n} nieuwe trades", { n: message.added })}
              {message.skipped ? tr(", {n} dubbel overgeslagen", { n: message.skipped }) : ""}.
              {message.warnings.map((w) => (
                <div key={w} style={{ color: COLORS.gold }}>
                  {w}
                </div>
              ))}
            </>
          ) : (
            message.text
          )}
        </div>
      )}

      <div className="mt-3">
        <Select label={tr("Tijdzone van het bestand")} value={fileTz} onChange={setFileTz} options={TIMEZONES.map((z) => ({ value: z, label: z }))} />
      </div>

      <div className="mt-2">
        <Collapse title={tr("Zo exporteer je uit Tradovate")}>
          <ol className="list-decimal list-inside text-xs flex flex-col gap-1" style={{ color: COLORS.textMuted }}>
            <li><Rich k="Open Tradovate en ga naar <b>Account → Reports</b> (of Orders)." /></li>
            <li>{tr("Kies je account en het datumbereik.")}</li>
            <li><Rich k="Exporteer de <b>Performance</b>- of <b>Orders</b>-lijst als CSV." /></li>
            <li>{tr("Zet hierboven de tijdzone van het bestand goed en sleep het bestand in het vak.")}</li>
          </ol>
          <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>
            {tr("Herkend: Tradovate Performance, Tradovate Orders (fills worden per positie samengevoegd) en de eigen CSV-export van dit journal. Dubbele trades worden overgeslagen.")}
          </p>
        </Collapse>
        <Collapse title={tr("Instellingen")}>
          <AccountSettings account={account} onUpdate={onUpdate} onDelete={onDelete} tradeCount={tradeCount} />
        </Collapse>
        <Collapse title={tr("Stortingen en opnames")}>
          <Adjustments account={account} tz={tz} onUpdate={onUpdate} />
        </Collapse>
      </div>
    </Card>
  );
}

function NewAccount({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", broker: "Tradovate", type: "LIVE", startBalance: "10000", riskUnit: "%", riskValue: "1", riskMode: "FIXED" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl flex flex-col items-center justify-center gap-1 text-xs min-h-40"
        style={{ border: `1px dashed ${COLORS.cardBorder}`, color: COLORS.textMuted }}
      >
        <Plus size={20} />
        {tr("Nieuw account")}
      </button>
    );
  }
  const submit = (e) => {
    e.preventDefault();
    onAdd({
      name: f.name.trim() || "Nieuw account",
      broker: f.broker.trim() || "Handmatig",
      type: f.type,
      startBalance: Number(f.startBalance.replace(",", ".")) || 0,
      riskUnit: f.riskUnit,
      riskValue: Number(f.riskValue.replace(",", ".")) || 0,
      riskMode: f.riskMode,
    });
    setOpen(false);
  };
  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
          {tr("Nieuw account")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Naam")}>
            <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("Bijv. AMP live")} />
          </Field>
          <Field label={tr("Broker")}>
            <TextInput value={f.broker} onChange={(e) => set("broker", e.target.value)} />
          </Field>
          <Field label={tr("Startsaldo (optioneel)")}>
            <TextInput inputMode="decimal" value={f.startBalance} onChange={(e) => set("startBalance", e.target.value)} />
          </Field>
          <Field label={tr("Risico per trade ({u})", { u: f.riskUnit })}>
            <TextInput inputMode="decimal" value={f.riskValue} onChange={(e) => set("riskValue", e.target.value)} />
          </Field>
        </div>
        <Segmented size="sm" value={f.type} onChange={(v) => set("type", v)} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))} ariaLabel={tr("Type account")} />
        <div className="flex flex-wrap gap-2">
          <Segmented size="sm" value={f.riskUnit} onChange={(v) => set("riskUnit", v)} options={[{ value: "%", label: "%" }, { value: "$", label: "$" }]} ariaLabel={tr("Risico-eenheid")} />
          <Segmented size="sm" value={f.riskMode} onChange={(v) => set("riskMode", v)} options={[{ value: "FIXED", label: "Vast risico" }, { value: "COMPOUNDING", label: "Samengesteld" }]} ariaLabel={tr("Risicomodus")} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(false)}>{tr("Annuleren")}</Button>
          <button type="submit" className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: COLORS.gold, color: "#0A0A0A" }}>
            {tr("Account toevoegen")}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function ImportView({ journal, accountBalances, tradeCounts, footer = null }) {
  const { accounts, settings, updateSettings, addAccount, updateAccount, deleteAccount, importTrades, exportBackup, restoreBackup, resetAll } = journal;
  const [backupMsg, setBackupMsg] = useState(null);
  const restoreRef = useRef(null);

  async function onImportFile(account, file, fileTz) {
    const text = await file.text();
    const res = importCsv(text, { accountId: account.id, tz: fileTz, commission: account.commission });
    if (!res.trades.length) throw new Error(res.warnings[0] || tr("Geen trades gevonden in dit bestand."));
    const { added, skipped } = importTrades(res.trades, { filename: file.name, accountId: account.id, format: res.format });
    return { added, skipped, warnings: res.warnings.slice(0, 4), format: res.format };
  }

  async function backup() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dcramere-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg({ ok: true, text: tr("Backup gedownload.") });
  }

  async function restore(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!window.confirm(tr("Dit vervangt al je huidige accounts en trades door de backup. Doorgaan?"))) return;
      await restoreBackup(data);
      setBackupMsg({ ok: true, text: tr("Backup hersteld.") });
    } catch (err) {
      setBackupMsg({ ok: false, text: err.message || tr("Herstellen mislukt.") });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            tradeCount={tradeCounts.get(a.id) || 0}
            balance={accountBalances.get(a.id) ?? a.startBalance}
            tz={settings.timezone}
            onImportFile={onImportFile}
            onUpdate={(patch) => updateAccount(a.id, patch)}
            onDelete={() => deleteAccount(a.id)}
          />
        ))}
        <NewAccount onAdd={addAccount} />
      </div>

      <Card>
        <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>
          {tr("Journalinstellingen")}
        </h3>
        <Select label={tr("Tijdzone")} value={settings.timezone} onChange={(timezone) => updateSettings({ timezone })} options={TIMEZONES.map((z) => ({ value: z, label: z }))} className="mb-1 inline-flex" />
        <p className="text-[11px] mb-3" style={{ color: COLORS.textMuted }}>
          {tr("Bepaalt op welke dag, uur en weekdag een trade valt. Futures-handelaren kiezen meestal America/New_York.")}
        </p>

        <Collapse title={tr("Back-up en herstel")} defaultOpen>
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
            {tr("Je data staat alleen in deze browser. Download regelmatig een back-up (inclusief screenshots) en herstel die op een ander apparaat.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={backup}>{tr("Back-up downloaden (JSON)")}</Button>
            <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { restore(e.target.files[0]); e.target.value = ""; }} />
            <Button onClick={() => restoreRef.current && restoreRef.current.click()}>{tr("Back-up herstellen")}</Button>
          </div>
          {backupMsg && (
            <p className="text-xs mt-2" role="status" style={{ color: backupMsg.ok ? COLORS.green : COLORS.red }}>
              {backupMsg.text}
            </p>
          )}
        </Collapse>

        <Collapse title={tr("Importgeschiedenis ({n})", { n: (settings.imports || []).length })}>
          {(settings.imports || []).length === 0 ? (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {tr("Nog geen bestanden geïmporteerd.")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {settings.imports.map((i) => (
                <div key={i.id} className="flex justify-between gap-2 text-xs" style={{ color: COLORS.textMuted }}>
                  <span className="truncate">{i.filename}</span>
                  <span style={{ fontFamily: MONO }}>
                    {new Date(i.at).toLocaleDateString(getLang() === "en" ? "en-US" : "nl-NL")} · +{i.added}
                    {i.skipped ? ` (${tr("{n} dubbel", { n: i.skipped })})` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Collapse>

        <Collapse title={tr("Gevarenzone")}>
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
            {tr("Verwijdert al je accounts, trades, screenshots en instellingen uit deze browser. Dit kan niet ongedaan worden gemaakt.")}
          </p>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm(tr("Alles definitief verwijderen en opnieuw beginnen?"))) resetAll();
            }}
          >
            {tr("Alles verwijderen en opnieuw beginnen")}
          </Button>
        </Collapse>
      </Card>

      {footer}
    </div>
  );
}
