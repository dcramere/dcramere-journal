import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { COLORS, MONO } from "../theme.js";
import { tr } from "../i18n.js";
import { dateTimeLabel } from "../lib/format.js";
import { Button, Card } from "../ui/primitives.jsx";

// Privacy en account: wie keek er in mijn journal, en account verwijderen.
export function PrivacyCard({ user, onDeleted }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .get("/api/me/access-log")
      .then((r) => live && setEntries(r.entries))
      .catch(() => live && setEntries([]));
    return () => {
      live = false;
    };
  }, []);

  async function remove() {
    if (!window.confirm(tr("Je account en al je data definitief verwijderen? Dit kan niet ongedaan worden gemaakt."))) return;
    try {
      await api.del("/api/me");
      onDeleted();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold mb-1" style={{ color: COLORS.text }}>
        {tr("Privacy en account")}
      </h3>
      <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
        {user.name} · {user.email}
      </p>

      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: COLORS.gold, fontFamily: MONO }}>
        {tr("Wie keek er in mijn journal")}
      </div>
      {entries == null ? (
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {tr("Laden…")}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {tr("Nog niemand heeft je journal bekeken.")}
        </p>
      ) : (
        <div className="flex flex-col gap-1 mb-1">
          {entries.slice(0, 10).map((e) => (
            <div key={`${e.at}-${e.actor}`} className="flex justify-between gap-2 text-xs" style={{ color: COLORS.textMuted }}>
              <span>{tr("{name} (beheerder) bekeek je journal", { name: e.actor || tr("De beheerder") })}</span>
              <span style={{ fontFamily: MONO }}>{dateTimeLabel(e.at)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] mt-2 mb-3" style={{ color: COLORS.textMuted }}>
        {tr("De beheerder kan je journal alleen lezen, niet aanpassen.")}
      </p>

      {error && (
        <p role="alert" className="text-xs mb-2" style={{ color: COLORS.red }}>
          {error}
        </p>
      )}
      <Button variant="danger" onClick={remove}>
        {tr("Mijn account en data verwijderen")}
      </Button>
    </Card>
  );
}
