import React from "react";
import { COLORS } from "../theme.js";
import { tr } from "../i18n.js";

const TAGS = { b: COLORS.text, g: COLORS.gold, red: COLORS.red, green: COLORS.green };

// Vertaalde zin met opmaak: <b>vet</b>, <g>goud</g>, <red>rood</red>, <green>groen</green>.
export function Rich({ k, p }) {
  const s = tr(k, p);
  const parts = [];
  const re = /<(b|g|red|green)>(.*?)<\/\1>/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      <strong key={i++} style={{ color: TAGS[m[1]] }}>
        {m[2]}
      </strong>
    );
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(s.slice(last));
  return <>{parts}</>;
}
