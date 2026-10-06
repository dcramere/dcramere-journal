import React, { useEffect } from "react";
import { X } from "lucide-react";
import { COLORS, MONO } from "../theme.js";
import { tr } from "../i18n.js";

export const inputStyle = {
  background: COLORS.inputBg,
  border: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.text,
};

export function Card({ children, tone, className = "", style }) {
  const border =
    tone === "pos" ? "rgba(76,154,91,0.45)" : tone === "neg" ? "rgba(184,81,79,0.45)" : COLORS.cardBorder;
  const glow = tone === "pos" ? COLORS.greenSoft : tone === "neg" ? COLORS.redSoft : "transparent";
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        background: `linear-gradient(160deg, ${glow}, ${COLORS.card} 55%)`,
        border: `1px solid ${border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function HelpTip({ text }) {
  return (
    <span
      title={text}
      aria-label={text}
      tabIndex={0}
      className="inline-flex items-center justify-center rounded-full cursor-help select-none"
      style={{
        width: 14,
        height: 14,
        fontSize: 9,
        fontWeight: 700,
        color: COLORS.textMuted,
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    >
      ?
    </span>
  );
}

export function CardTitle({ title, help, tag }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5 mb-2">
      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest"
        style={{ color: COLORS.textMuted, fontFamily: MONO }}
      >
        {title}
        {help && <HelpTip text={help} />}
      </div>
      {tag && (
        <span className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
          {tag}
        </span>
      )}
    </div>
  );
}

export function Segmented({ options, value, onChange, size = "md", ariaLabel }) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-full p-0.5"
      style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, fontFamily: MONO }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`rounded-full font-semibold ${pad}`}
            style={{
              background: active ? COLORS.gold : "transparent",
              color: active ? "#0A0A0A" : COLORS.textMuted,
            }}
          >
            {o.raw ? o.label : tr(o.label)}
          </button>
        );
      })}
    </div>
  );
}

export function Select({ label, value, onChange, options, className = "" }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${className}`}
      style={{ background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}` }}
    >
      {label && (
        <span className="uppercase tracking-widest text-[9px] shrink-0" style={{ color: COLORS.textMuted, fontFamily: MONO }}>
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-semibold min-w-0 outline-none cursor-pointer"
        style={{ color: COLORS.text }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: COLORS.card }}>
            {o.raw ? o.label : tr(o.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className}`} style={{ color: COLORS.textMuted }}>
      {label}
      {children}
    </label>
  );
}

export function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} className={`rounded px-2 py-1.5 text-sm ${props.className || ""}`} />;
}

export function Button({ children, variant = "ghost", className = "", ...rest }) {
  const styles =
    variant === "primary"
      ? { background: COLORS.gold, color: "#0A0A0A", border: `1px solid ${COLORS.gold}` }
      : variant === "danger"
      ? { background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.red}` }
      : { background: COLORS.inputBg, color: COLORS.text, border: `1px solid ${COLORS.cardBorder}` };
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${className}`}
      style={styles}
    >
      {children}
    </button>
  );
}

export function Empty({ children }) {
  return (
    <div className="text-xs py-6 text-center" style={{ color: COLORS.textMuted }}>
      {typeof children === "string" ? tr(children) : children}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-2xl"} rounded-xl p-4 sm:p-5 my-4`}
        style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={tr("Sluiten")} style={{ color: COLORS.textMuted }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
