import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { COLORS, MONO } from "../theme.js";
import { getLang, tr } from "../i18n.js";
import { dateTimeLabel } from "../lib/format.js";
import { Button } from "../ui/primitives.jsx";

const Block = ({ title, color, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color, fontFamily: MONO }}>
      {title}
    </div>
    <div className="flex flex-col gap-2.5">{children}</div>
  </div>
);

const Point = ({ title, children, color }) => (
  <div className="pl-3" style={{ borderLeft: `2px solid ${color}` }}>
    <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
      {title}
    </div>
    <p className="text-xs leading-relaxed mt-0.5" style={{ color: COLORS.textMuted }}>
      {children}
    </p>
  </div>
);

// De uitleg als gewone tekst, voor kopiëren en doorsturen.
export function explanationText(content, heading) {
  const list = (items) => items.map((i) => `• ${i.title}: ${i.detail}`);
  return [
    heading,
    "",
    content.summary,
    ...(content.strengths.length ? ["", tr("Sterke punten"), ...list(content.strengths)] : []),
    ...(content.leaks.length ? ["", tr("Waar winst weglekt"), ...list(content.leaks)] : []),
    ...(content.patterns.length ? ["", tr("Patronen"), ...list(content.patterns)] : []),
    "",
    tr("Plan voor de komende periode"),
    ...content.plan.map((p, i) => `${i + 1}. ${p.action} (${p.why})`),
    "",
    content.caution,
  ].join("\n");
}

// Uitgebreide uitleg bij een rapport, geschreven door een AI op basis van de cijfers van het rapport.
export function AiExplanation({ report, heading, enabled, onGenerate }) {
  const lang = getLang();
  const entry = report.ai?.[lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!enabled && !entry) return null;

  async function run() {
    setBusy(true);
    setError("");
    try {
      await onGenerate(report, lang);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(explanationText(entry.content, heading));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const c = entry?.content;
  return (
    <div className="rounded-lg p-3" style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.gold }}>
          <Sparkles size={16} />
          {tr("Uitgebreide uitleg met AI")}
        </div>
        {entry && enabled && (
          <div className="flex gap-2">
            <Button onClick={copy}>{copied ? tr("Gekopieerd") : tr("Kopieer uitleg")}</Button>
            <Button onClick={run} disabled={busy}>
              {busy ? tr("Bezig…") : tr("Vernieuw uitleg")}
            </Button>
          </div>
        )}
        {entry && !enabled && <Button onClick={copy}>{copied ? tr("Gekopieerd") : tr("Kopieer uitleg")}</Button>}
      </div>

      {!entry && (
        <div className="mt-2">
          <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
            {tr("Een AI legt dit rapport uitgebreid uit: wat de cijfers betekenen, waarom ze ertoe doen en wat je volgende periode kunt oefenen. Alleen de cijfers van dit rapport gaan naar de AI, zonder naam, e-mailadres of notities.")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={run} disabled={busy}>
              {busy ? tr("Bezig…") : tr("Maak uitleg met AI")}
            </Button>
            {busy && (
              <span className="text-xs" style={{ color: COLORS.textMuted }}>
                {tr("De uitleg wordt geschreven. Dit duurt ongeveer een halve minuut.")}
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs mt-2" style={{ color: COLORS.red }}>
          {error}
        </p>
      )}

      {entry && (
        <div className="mt-3 flex flex-col gap-4">
          {entry.stale && (
            <p className="text-xs rounded px-2 py-1.5" style={{ color: COLORS.gold, border: `1px solid ${COLORS.gold}` }}>
              {tr("Dit rapport is veranderd sinds deze uitleg is gemaakt. Vernieuw de uitleg om de nieuwe cijfers mee te nemen.")}
            </p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: COLORS.text }}>
            {c.summary}
          </p>
          {c.strengths.length > 0 && (
            <Block title={tr("Sterke punten")} color={COLORS.green}>
              {c.strengths.map((i, k) => (
                <Point key={k} title={i.title} color={COLORS.green}>
                  {i.detail}
                </Point>
              ))}
            </Block>
          )}
          {c.leaks.length > 0 && (
            <Block title={tr("Waar winst weglekt")} color={COLORS.gold}>
              {c.leaks.map((i, k) => (
                <Point key={k} title={i.title} color={COLORS.gold}>
                  {i.detail}
                </Point>
              ))}
            </Block>
          )}
          {c.patterns.length > 0 && (
            <Block title={tr("Patronen")} color={COLORS.textMuted}>
              {c.patterns.map((i, k) => (
                <Point key={k} title={i.title} color={COLORS.grid}>
                  {i.detail}
                </Point>
              ))}
            </Block>
          )}
          <Block title={tr("Plan voor de komende periode")} color={COLORS.gold}>
            {c.plan.map((p, k) => (
              <Point key={k} title={`${k + 1}. ${p.action}`} color={COLORS.gold}>
                {p.why}
              </Point>
            ))}
          </Block>
          <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
            {c.caution}
          </p>
          <p className="text-[10px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
            {tr("Gemaakt door AI op {d}, alleen op basis van de cijfers in dit rapport. Dit is uitleg, geen financieel advies.", { d: dateTimeLabel(entry.createdAt) })}
          </p>
        </div>
      )}
    </div>
  );
}
