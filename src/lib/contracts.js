// Waarde per punt (dollar per volledig punt) voor veelgehandelde futures.
const POINT_VALUE = {
  ES: 50,
  MES: 5,
  NQ: 20,
  MNQ: 2,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1000,
  MCL: 100,
  GC: 100,
  MGC: 10,
  SI: 5000,
  SIL: 1000,
  NG: 10000,
  ZB: 1000,
  ZN: 1000,
  ZF: 1000,
  "6E": 125000,
  "6B": 62500,
  BTC: 5,
  MBT: 0.1,
  ETH: 50,
  MET: 0.1,
};

// MNQZ6 -> MNQ, ESH26 -> ES. Symbolen zonder maandcode blijven ongewijzigd.
export function rootSymbol(symbol) {
  const s = String(symbol || "").trim().toUpperCase();
  const m = s.match(/^(.*?)([FGHJKMNQUVXZ])(\d{1,2})$/);
  return m && m[1] ? m[1] : s;
}

export function pointValue(symbol) {
  return POINT_VALUE[rootSymbol(symbol)] ?? null;
}

export const KNOWN_ROOTS = Object.keys(POINT_VALUE);
