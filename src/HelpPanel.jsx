import React, { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { COLORS, MONO } from "./theme.js";
import { getLang, tr } from "./i18n.js";
import { Modal } from "./ui/primitives.jsx";
import { Rich } from "./ui/Rich.jsx";
import { GUIDE_ADMIN_SECTION as ADMIN_SECTION, GUIDE_SECTIONS as SECTIONS } from "./lib/guide.js";

function Body({ line }) {
  // Eerst vertalen (de sleutel bevat het bolletje), dan pas het bolletje weghalen.
  const translated = tr(line);
  const bullet = translated.startsWith("• ");
  const text = bullet ? translated.slice(2) : translated;
  return (
    <li className={`flex gap-2 ${bullet ? "" : "list-none"}`} style={{ listStyle: "none" }}>
      {bullet && (
        <span aria-hidden="true" style={{ color: COLORS.gold }}>
          •
        </span>
      )}
      <span>
        <Rich k={text} done />
      </span>
    </li>
  );
}

const plain = (s) => tr(s).replace(/<\/?(b|g|red|green)>/g, "").toLowerCase();

export default function HelpPanel({ onClose, isAdmin = false }) {
  const sections = useMemo(() => (isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS), [isAdmin]);
  const [open, setOpen] = useState(() => new Set(["start"]));
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const visible = useMemo(
    () => (needle ? sections.filter((s) => plain(s.title).includes(needle) || s.body.some((l) => plain(l).includes(needle))) : sections),
    [sections, needle]
  );
  const isOpen = (id) => Boolean(needle) || open.has(id);
  const allOpen = open.size >= sections.length;

  const toggle = (id) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal title={tr("Hoe gebruik je de journal")} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label
          className="flex items-center gap-2 flex-1 min-w-40 rounded-lg px-3 py-1.5 text-xs"
          style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.textMuted }}
        >
          <Search size={14} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Zoek in de handleiding")}
            aria-label={tr("Zoek in de handleiding")}
            className="bg-transparent outline-none flex-1 min-w-0"
            style={{ color: COLORS.text }}
          />
        </label>
        {!needle && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.id)))}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
          >
            {allOpen ? tr("Alles inklappen") : tr("Alles openen")}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: COLORS.textMuted }}>
          {tr("Niets gevonden. Probeer een ander woord.")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((s) => {
            const expanded = isOpen(s.id);
            return (
              <section key={s.id} className="rounded-lg" style={{ background: COLORS.inputBg, border: `1px solid ${expanded ? COLORS.cardBorder : COLORS.grid}` }}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-expanded={expanded}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="text-sm font-semibold" style={{ color: s.id === "admin" ? COLORS.gold : COLORS.text }}>
                    {tr(s.title)}
                  </span>
                  <ChevronDown size={14} style={{ color: COLORS.textMuted, transform: expanded ? "rotate(180deg)" : "none" }} />
                </button>
                {expanded && (
                  <ul className="px-3 pb-3 flex flex-col gap-2 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                    {s.body.map((line) => (
                      <Body key={line} line={line} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <p className="text-[11px]" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
          {tr("Kom je er niet uit? Vraag het je coach.")}
        </p>
        <a
          href={getLang() === "en" ? "/guide/dcramere-journal-user-guide-en.pdf" : "/guide/dcramere-journal-handleiding-nl.pdf"}
          download
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: COLORS.gold, color: "#0A0A0A" }}
        >
          <Download size={13} /> {tr("Download als PDF")}
        </a>
      </div>
    </Modal>
  );
}
