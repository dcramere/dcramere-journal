import React from "react";
import { COLORS, MONO, PERIODS } from "../theme.js";
import { Segmented, Select } from "../ui/primitives.jsx";
import { tr } from "../i18n.js";

const UNIT_OPTIONS = [
  { value: "$", label: "$" },
  { value: "%", label: "%" },
  { value: "R", label: "R" },
];

export function FilterBar({ accounts, settings, onChange, tz }) {
  const account = accounts.find((a) => a.id === settings.accountId); const riskLabel = account ? (account.riskMode === "COMPOUNDING" ? "COMPOUNDING" : "FIXED RISK") : null; return (
    <div
      className="sticky top-0 z-30 -mx-4 px-4 py-2 mb-4 flex flex-wrap items-center gap-2"
      style={{ background: "rgba(10,10,10,0.88)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${COLORS.grid}` }}
    >
      <Select
        label={tr("Periode")}
        value={settings.period}
        onChange={(period) => onChange({ period })}
        options={PERIODS}
      />
      <Select
        label={tr("Account")}
        value={settings.accountId}
        onChange={(accountId) => onChange({ accountId })}
        options={[{ value: "all", label: "Alle accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.name, raw: true }))]}
      />
      {riskLabel && (
        <span
          className="hidden sm:inline text-[9px] uppercase tracking-widest rounded px-2 py-1"
          style={{ color: COLORS.textMuted, border: `1px solid ${COLORS.cardBorder}`, fontFamily: MONO }}
        >
          {riskLabel}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden md:inline text-[9px] uppercase tracking-widest" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
          {tz.split("/").pop().replace("_", " ")}
        </span>
        <Segmented options={UNIT_OPTIONS} value={settings.unit} onChange={(unit) => onChange({ unit })} ariaLabel={tr("Weergave in $, % of R")} />
      </div>
    </div>
  );
}
