import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Forward /api/* to the agentos-server on :4000 so the product UI can call
// the orchestration backend without CORS gymnastics in dev.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const apiUrl = env.VITE_API_URL || "http://localhost:4000";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/jira-intake": {
          target: apiUrl,
          changeOrigin: true,
        },
        "/git-integration": {
          target: apiUrl,
          changeOrigin: true,
        },
        "/pipeline-jira": {
          target: apiUrl,
          changeOrigin: true,
        },
        "/api/codebase/viz/ws": {
          target: apiUrl,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React + routing — loaded on every page, keep together
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router") ||
              id.includes("node_modules/scheduler/")
            ) {
              return "react-vendor";
            }
            // Framer Motion — only needed in the authenticated org shell
            if (id.includes("node_modules/framer-motion")) {
              return "framer-motion";
            }
            // GSAP — marketing landing page only
            if (id.includes("node_modules/gsap")) {
              return "gsap";
            }
            // D3 — codebase visualization only
            if (id.includes("node_modules/d3") || id.includes("node_modules/d3-")) {
              return "d3";
            }
            // Zod — schema validation
            if (id.includes("node_modules/zod")) {
              return "zod";
            }
          },
        },
      },
      // Raise the warning threshold slightly; our known large chunks are intentionally isolated
      chunkSizeWarningLimit: 600,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
    },
  };
});
