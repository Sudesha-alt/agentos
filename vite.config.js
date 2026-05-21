import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Forward /api/* to the agentos-server on :4000 so the product UI can call
// the orchestration backend without CORS gymnastics in dev.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const jiraIntakeUrl = env.VITE_JIRA_INTAKE_URL || "http://localhost:3000";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/jira-intake": {
          target: jiraIntakeUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jira-intake/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
    },
  };
});
