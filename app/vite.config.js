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
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
    },
  };
});
