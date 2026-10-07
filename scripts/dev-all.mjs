// Start de API (poort 8787) en Vite (poort 5173) samen; Vite stuurt /api door.
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: false });
const api = run("node", ["scripts/dev-api.mjs"]);
const web = run("npx", ["vite"]);
const stop = () => {
  api.kill();
  web.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.on("exit", () => {
  api.kill();
  process.exit(0);
});
