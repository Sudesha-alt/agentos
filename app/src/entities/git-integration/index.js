import { DATA_MODE } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const intake = (path) => apiPath("/git-integration", path);

const restGitIntegrationAdapter = {
  getSetup: () => fetchJson(intake("/integration/setup")),
  connect: (body) =>
    fetchJson(intake("/integration/connect"), {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeInstall: (installationId) =>
    fetchJson(intake("/github/complete-install"), {
      method: "POST",
      body: JSON.stringify({ installationId }),
    }),
  selectRepo: (body) =>
    fetchJson(intake("/github/select-repo"), {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

const mockGitIntegrationAdapter = {
  getSetup: () => mockApi.gitIntegrationSetup(),
  connect: (body) => mockApi.connectGitIntegration(body),
  completeInstall: (installationId) => mockApi.completeGithubInstall(installationId),
  selectRepo: (body) => mockApi.selectGithubRepository(body),
};

export const gitIntegrationAdapter =
  DATA_MODE === "rest" ? restGitIntegrationAdapter : mockGitIntegrationAdapter;

export async function getGitIntegrationSetup() {
  return gitIntegrationAdapter.getSetup();
}

export async function connectGitIntegration(body) {
  return gitIntegrationAdapter.connect(body);
}

export function startGithubAppInstall() {
  window.location.href = intake("/oauth/github/install");
}

export async function completeGithubInstall(installationId) {
  return gitIntegrationAdapter.completeInstall(installationId);
}

export async function selectGithubRepository(body) {
  return gitIntegrationAdapter.selectRepo(body);
}

export { useIndexProgress, fetchIndexStatus } from "./useIndexProgress";

/** Dashboard summary: connection status and repo label. */
export async function fetchGitIntegrationSummary() {
  const setup = await getGitIntegrationSetup();
  const git = setup?.git;
  const needsRepoSelection = Boolean(setup?.needsRepoSelection);
  const repoLabel =
    setup?.connected && git?.workspace && git?.repoSlug
      ? `${git.workspace}/${git.repoSlug}`
      : null;
  return {
    connected: Boolean(setup?.connected),
    needsRepoSelection,
    repoLabel,
    authMethod: git?.authMethod ?? null,
    installationId: git?.installationId ?? null,
    githubAppConfigured: Boolean(setup?.githubApp?.configured),
  };
}

export function useGitIntegrationSummary(options = {}) {
  return useResource(() => fetchGitIntegrationSummary(), [], {
    pollMs: options.pollMs ?? 12000,
  });
}

export function useGitIntegrationSetup(options = {}) {
  return useResource(() => getGitIntegrationSetup(), [], {
    pollMs: options.pollMs ?? 30000,
  });
}
