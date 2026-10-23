import React, { useState } from "react";
import { ArrowDown, ArrowUp, EyeOff } from "lucide-react";
import { COLORS, MONO } from "../theme.js";
import { tr } from "../i18n.js";
import { Empty } from "../ui/primitives.jsx";
import { LayoutBar } from "./LayoutBar.jsx";

function IconBtn({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 disabled:opacity-30"
      style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text }}
    >
      {children}
    </button>
  );
}

// Een raster van widgets met de indelingsbalk erboven.
//   kit      de indeling van dit tabblad (createLayouts in lib/layout.js)
//   widgets  { id: { label, size, render() } }
//   spans    { size: tailwind-klassen } voor de breedte per soort widget
//   gridClass  klassen van het raster zelf
export function WidgetGrid({ kit, widgets, spans, gridClass }) {
  const [layouts, setLayouts] = useState(() => kit.load());
  const [draft, setDraft] = useState(null); // null = niet aan het indelen; anders de werkvolgorde
  const arranging = draft !== null;
  const order = arranging ? draft : kit.orderFor(layouts);
  const commit = (next) => {
    setLayouts(next);
    kit.persist(next);
  };

  return (
    <>
      <LayoutBar
        kit={kit}
        layouts={layouts}
        arranging={arranging}
        draft={draft}
        labelOf={(id) => tr(widgets[id].label)}
        onPick={(name) => commit({ ...layouts, active: name })}
        onStart={() => setDraft(kit.orderFor(layouts))}
        onCancel={() => setDraft(null)}
        onSave={(name) => {
          commit(kit.saveAs(layouts, name, draft));
          setDraft(null);
        }}
        onDelete={(name) => commit(kit.removeLayout(layouts, name))}
        onAdd={(id) => setDraft(kit.addWidget(draft, id))}
        onReset={() => setDraft([...kit.defaultOrder])}
      />

      {order.length === 0 && <Empty>{tr("Alle widgets zijn verborgen. Kies ‘Indelen / widget toevoegen’ om ze terug te zetten.")}</Empty>}

      <div className={gridClass}>
        {order.map((id, i) => {
          const w = widgets[id];
          return (
            <div key={id} className={`flex flex-col ${spans[w.size]} ${arranging ? "rounded-xl p-1.5" : ""}`} style={arranging ? { border: `1px dashed ${COLORS.cardBorder}` } : undefined}>
              {arranging && (
                <div className="flex items-center justify-between gap-1 pb-1.5">
                  <span className="text-[10px] uppercase tracking-widest truncate" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
                    {tr(w.label)}
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <IconBtn label={tr("Omhoog")} disabled={i === 0} onClick={() => setDraft(kit.moveWidget(draft, id, -1))}>
                      <ArrowUp size={13} />
                    </IconBtn>
                    <IconBtn label={tr("Omlaag")} disabled={i === order.length - 1} onClick={() => setDraft(kit.moveWidget(draft, id, 1))}>
                      <ArrowDown size={13} />
                    </IconBtn>
                    <IconBtn label={tr("Verbergen")} onClick={() => setDraft(kit.hideWidget(draft, id))}>
                      <EyeOff size={13} />
                    </IconBtn>
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col [&>*]:flex-1">{w.render()}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
