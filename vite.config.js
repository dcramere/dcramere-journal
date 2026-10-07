import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Lokaal draait de API (scripts/dev-api.mjs) op 8787; op Vercel zijn het functies onder /api.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: false } },
  },
});
