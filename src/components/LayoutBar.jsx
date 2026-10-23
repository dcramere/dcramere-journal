import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { COLORS, MONO } from "../theme.js";
import { tr } from "../i18n.js";
import { Button, Select, TextInput } from "../ui/primitives.jsx";
import { DEFAULT_NAME, MAX_NAME, cleanName } from "../lib/layout.js";

// Kiezen tussen indelingen en het aanpassen ervan: widgets verplaatsen, verbergen, terugzetten en opslaan onder een naam.
export function LayoutBar({ kit, layouts, arranging, draft, labelOf, onPick, onStart, onCancel, onSave, onDelete, onAdd, onReset }) {
  const [name, setName] = useState("");
  const names = Object.keys(layouts.saved);
  const options = [{ value: DEFAULT_NAME, label: tr("Standaard"), raw: true }, ...names.map((n) => ({ value: n, label: n, raw: true }))];
  const clean = cleanName(name);
  const canSave = Boolean(clean) && clean !== DEFAULT_NAME;

  if (!arranging) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Select label={tr("Indeling")} value={layouts.active} onChange={onPick} options={options} />
        {layouts.active !== DEFAULT_NAME && (
          <Button onClick={() => onDelete(layouts.active)} aria-label={tr("Deze indeling verwijderen")} title={tr("Deze indeling verwijderen")}>
            <Trash2 size={13} />
          </Button>
        )}
        <Button
          onClick={() => {
            setName(layouts.active === DEFAULT_NAME ? "" : layouts.active);
            onStart();
          }}
        >
          {tr("Indelen / widget toevoegen")}
        </Button>
      </div>
    );
  }

  const hidden = kit.hiddenOf(draft);
  return (
    <div className="rounded-xl p-3 flex flex-col gap-3" style={{ border: `1px solid ${COLORS.gold}`, background: COLORS.card }}>
      <p className="text-xs" style={{ color: COLORS.textMuted }}>
        {tr("Verplaats een widget met de pijltjes, verberg wat je niet nodig hebt en sla je indeling op onder een naam. Dit geldt alleen in deze browser.")}
      </p>
      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
            {tr("Widget toevoegen")}
          </span>
          {hidden.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onAdd(id)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
            >
              <Plus size={11} /> {labelOf(id)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr("Naam van de indeling")}
          aria-label={tr("Naam van de indeling")}
          className="min-w-40"
        />
        <Button variant="primary" disabled={!canSave} onClick={() => onSave(clean)}>
          {tr("Opslaan")}
        </Button>
        <Button onClick={onReset}>{tr("Standaard terugzetten")}</Button>
        <Button onClick={onCancel}>{tr("Annuleren")}</Button>
      </div>
    </div>
  );
}
