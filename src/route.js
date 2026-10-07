// Hash-routes: #/journal (eigen journal), #/admin (klantenlijst), #/admin/user/<id>/journal (klant, alleen lezen), #/setup.
export const TAB_IDS = ["import", "journal", "trades", "stats", "reports"];

export function parseRoute() {
  const [path, queryString = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "setup") return { name: "setup" };
  if (parts[0] === "reset") return { name: "reset", token: new URLSearchParams(queryString).get("token") || "" };
  if (parts[0] === "admin") {
    if (parts[1] === "user" && parts[2]) return { name: "client", id: parts[2], tab: TAB_IDS.includes(parts[3]) ? parts[3] : "journal" };
    return { name: "admin" };
  }
  return { name: "own", tab: TAB_IDS.includes(parts[0]) ? parts[0] : "journal" };
}
