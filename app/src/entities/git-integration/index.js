import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";

const intake = (path) => apiPath("/git-integration", path);

export function useGitIntegrationSetup() {
  return {
    queryKey: ["git-integration", "setup"],
    queryFn: () => fetchJson(intake("/integration/setup")),
  };
}

export async function getGitIntegrationSetup() {
  return fetchJson(intake("/integration/setup"));
}

export async function connectGitIntegration(body) {
  return fetchJson(intake("/integration/connect"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
