import React from "react";
import { X, HelpCircle } from "lucide-react";
import { COLORS } from "./theme.js";

function Strong({ children }) {
  return <strong style={{ color: COLORS.text }}>{children}</strong>;
}

export default function HelpPanel({ onClose }) {
  return (
    <div
      style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
      className="rounded-lg p-4 sm:p-5 mb-8"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ color: COLORS.text }} className="text-sm font-semibold flex items-center gap-2">
          <HelpCircle size={16} color={COLORS.gold} />
          Hoe gebruik je de journal
        </h2>
        <button type="button" onClick={onClose} style={{ color: COLORS.textMuted }} aria-label="Sluiten">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-4 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
        <div>
          <p style={{ color: COLORS.text }} className="font-semibold mb-1">
            Een trade loggen
          </p>
          <p>
            Alleen <Strong>symbool</Strong> en <Strong>resultaat in R</Strong> zijn verplicht. Richting,
            entry/exit, positiegrootte, reden, fout/les, emotionele toestand en screenshot zijn optioneel —
            maar leveren betere inzichten op.
          </p>
        </div>

        <div>
          <p style={{ color: COLORS.text }} className="font-semibold mb-1">
            Emotionele toestand
          </p>
          <p>
            Kies vóór het loggen hoe je je voelde. Hoe eerlijker je dit invult, hoe bruikbaarder de grafiek
            hieronder — zo zie je zwart-op-wit welke gemoedstoestanden (bijv. wraaktrades na een verlies) je
            geld kosten.
          </p>
        </div>

        <div>
          <p style={{ color: COLORS.text }} className="font-semibold mb-1">
            Inzichten &amp; patronen
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <Strong>Equity curve</Strong> — je cumulatieve R-resultaat over tijd. Tik of hover op een punt
              voor de details van die trade.
            </li>
            <li>
              <Strong>Gem. R per emotionele toestand</Strong> — groen = gemiddeld winstgevend, rood =
              gemiddeld verlieslatend per gelogde stemming.
            </li>
            <li>
              <Strong>Win rate per reden</Strong> — welke Handelsweg-stappen daadwerkelijk raak zijn.
            </li>
          </ul>
          <p className="mt-1">
            Bij minder dan 5 trades zijn de patronen nog niet statistisch betrouwbaar — hoe meer je logt,
            hoe scherper het beeld.
          </p>
        </div>

        <div>
          <p style={{ color: COLORS.text }} className="font-semibold mb-1">
            Data-opslag
          </p>
          <p>
            Alles staat lokaal opgeslagen in de browser van dit apparaat (<code>localStorage</code>). Er is
            geen sync tussen bijvoorbeeld je telefoon en laptop, en als je browserdata wist, ben je je
            journal kwijt.
          </p>
        </div>
      </div>
    </div>
  );
}
