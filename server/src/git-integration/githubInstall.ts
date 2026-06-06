import {
  getInstallationAccessToken,
  listInstallationRepositories,
  type InstallationRepo,
} from "../integrations/git/githubApp";
import {
  getPublicGitCredentials,
  saveGitCredentials,
  saveGithubAppInstallation,
} from "./gitCredentialsStore";

export async function completeGithubInstallation(installationId: string) {
  const id = installationId.trim();
  if (!id) throw new Error("installationId is required");

  const repositories = await listInstallationRepositories(id);
  saveGithubAppInstallation(id);

  return {
    installationId: id,
    repositories,
    git: getPublicGitCredentials(),
  };
}

export async function selectGithubRepository(input: {
  installationId: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
}) {
  const installationId = input.installationId.trim();
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  if (!installationId || !owner || !repo) {
    throw new Error("installationId, owner, and repo are required");
  }

  const token = await getInstallationAccessToken(installationId);
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!repoRes.ok) {
    throw new Error(`GitHub repo lookup failed: ${repoRes.status}`);
  }
  const meta = (await repoRes.json()) as {
    full_name: string;
    default_branch?: string;
  };

  saveGitCredentials({
    provider: "github",
    workspace: owner,
    repoSlug: repo,
    token,
    authMethod: "github_app",
    installationId,
    defaultBranch:
      input.defaultBranch?.trim() || meta.default_branch || "main",
  });

  return {
    connected: true,
    fullName: meta.full_name,
    defaultBranch: input.defaultBranch?.trim() || meta.default_branch || "main",
    git: getPublicGitCredentials(),
  };
}

export type { InstallationRepo };
