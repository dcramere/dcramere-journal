import { api } from "./api.js";
import { storage } from "./storage.js";

// Screenshots komen uit localStorage (lokale modus), uit de eigen server-account,
// of — voor de beheerder — uit het journal van een klant.
let mode = { kind: "local" };

export function configureShots(next) {
  mode = next;
}

export async function getShot(tradeId) {
  if (mode.kind === "local") return (await storage.get(`screenshot:${tradeId}`, false)).value;
  if (mode.kind === "admin") return (await api.get(`/api/admin/users/${mode.userId}/screenshots/${encodeURIComponent(tradeId)}`)).data;
  return (await api.get(`/api/screenshots/${encodeURIComponent(tradeId)}`)).data;
}

export async function setShot(tradeId, dataUrl) {
  if (mode.kind === "local") return storage.set(`screenshot:${tradeId}`, dataUrl, false);
  return api.put(`/api/screenshots/${encodeURIComponent(tradeId)}`, { data: dataUrl });
}

export async function deleteShot(tradeId) {
  if (mode.kind === "local") return storage.delete(`screenshot:${tradeId}`, false);
  return api.del(`/api/screenshots/${encodeURIComponent(tradeId)}`);
}
