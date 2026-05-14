import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Forward /api/* to the agentos-server on :4000 so the product UI can call
// the orchestration backend without CORS gymnastics in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
