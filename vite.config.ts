import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GLSL shaders are imported as raw strings via ?raw (built-in Vite feature).
// JPL's ssd-api sends no CORS headers, so browser fetches are blocked. Proxy
// them through the dev server under /jpl. (NASA api.nasa.gov allows CORS and is
// called directly.) Production hosting needs an equivalent rewrite for /jpl.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/jpl": {
        target: "https://ssd-api.jpl.nasa.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jpl/, ""),
      },
    },
  },
});
