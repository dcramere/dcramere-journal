import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { COLORS } from "../theme.js";
import { tr } from "../i18n.js";
import { money, shortDate } from "../lib/format.js";

const KEY = "dcramere-journal-balance-notice";
const read = () => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};
const idOf = (w) => `${w.accountId}|${Math.round(w.balance)}`;

// Waarschuwing als het saldo volgens de trades onder nul zakt: dan ontbreken er stortingen of trades.
// Wegklikken geldt per browser en alleen voor dit laagste punt; zakt het nog verder, dan komt de melding terug.
export function BalanceNotice({ warnings }) {
  const [hidden, setHidden] = useState(read);
  const shown = warnings.filter((w) => !hidden.includes(idOf(w)));
  if (!shown.length) return null;

  const dismiss = (w) => {
    const next = [...hidden, idOf(w)];
    setHidden(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // zonder opslag blijft de melding alleen tijdens dit bezoek weg
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {shown.map((w) => (
        <div key={w.accountId} role="alert" className="rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs leading-relaxed" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.gold}`, color: COLORS.text }}>
          <AlertTriangle size={15} color={COLORS.gold} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">{tr("Het saldo van ‘{name}’ komt onder nul", { name: w.name })}</div>
            <p style={{ color: COLORS.textMuted }}>
              {tr("Volgens je trades zakte het laagste punt naar {v} op {d}. Dat kan niet op een echte rekening, dus er ontbreken waarschijnlijk stortingen of trades. Vergelijk het saldo met dat van je broker en controleer ‘Stortingen en opnames’ en je geïmporteerde bestanden. Tot dat klopt, zijn saldo, percentages en terugval onbetrouwbaar.", { v: money(w.balance), d: shortDate(w.day) })}
            </p>
          </div>
          <button type="button" onClick={() => dismiss(w)} aria-label={tr("Melding verbergen")} title={tr("Melding verbergen")} style={{ color: COLORS.textMuted }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
