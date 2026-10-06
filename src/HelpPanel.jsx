import React from "react";
import { X, HelpCircle } from "lucide-react";
import { COLORS } from "./theme.js";
import { tr } from "./i18n.js";
import { Rich } from "./ui/Rich.jsx";

function Block({ title, children }) {
  return (
    <div>
      <p style={{ color: COLORS.text }} className="font-semibold mb-1">
        {tr(title)}
      </p>
      {children}
    </div>
  );
}

export default function HelpPanel({ onClose }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }} className="rounded-xl p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ color: COLORS.text }} className="text-sm font-semibold flex items-center gap-2">
          <HelpCircle size={16} color={COLORS.gold} />
          {tr("Hoe gebruik je de journal")}
        </h2>
        <button type="button" onClick={onClose} style={{ color: COLORS.textMuted }} aria-label={tr("Sluiten")}>
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
        <Block title="1. Begin bij Import">
          <p>
            <Rich k="Pas je account aan (naam, type, <b>startsaldo</b> en <b>gepland risico per trade</b>) en sleep je Tradovate-export (Performance of Orders, CSV) in het vak. Trades die je al had worden overgeslagen. Liever zelf loggen? Gebruik de knop <b>+ Trade</b> rechtsboven." />
          </p>
        </Block>

        <Block title="2. Een trade loggen">
          <p>
            <Rich k="Vul symbool, richting, aantal en een resultaat in ($ of R). Met entry, exit en aantal van een bekend contract (MNQ, ES, NQ …) rekent de app het resultaat zelf uit. Vink vooraf je <b>emotionele toestand</b> aan en noteer eventueel een les of screenshot." />
          </p>
        </Block>

        <Block title="3. Journal, Trades en Stats">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <Rich k="<b>Journal</b> — kerncijfers, jaar- en maandkalender en de grafieken. Klik een dag om zijn trades te zien." />
            </li>
            <li>
              <Rich k="<b>Trades</b> — alle trades per dag. Klik een trade voor details, screenshot, bewerken of verwijderen." />
            </li>
            <li>
              <Rich k="<b>Stats</b> — streaks, drawdown, per weekdag/uur/contract/richting/emotie/setup, tijd tot doel, Monte Carlo, kans op ruïne en Kelly (die laatste drie pas vanaf 100 trades)." />
            </li>
          </ul>
        </Block>

        <Block title="4. Filters en eenheid">
          <p>
            <Rich k="Bovenin kies je <b>periode</b> en <b>account</b>. De knop <b>$ / % / R</b> schakelt elk cijfer en elke grafiek tussen dollars, procent van je account en R-veelvouden van je geplande risico." />
          </p>
        </Block>

        <Block title="5. Emotie-patronen">
          <p>{tr("Bij Journal en Stats zie je het gemiddelde resultaat per emotionele toestand. Zo zie je zwart-op-wit welke gemoedstoestanden (bijv. wraaktrades na een verlies) je geld kosten.")}</p>
        </Block>

        <Block title="6. Je data">
          <p>
            <Rich k="Alles staat lokaal in de browser van dit apparaat (localStorage); er is geen sync tussen telefoon en laptop. Download daarom regelmatig een <b>back-up</b> op het tabblad Import, of een CSV op het tabblad Trades." />
          </p>
        </Block>
      </div>
    </div>
  );
}
