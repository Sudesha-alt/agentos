import "dotenv/config";
import { restoreGitCredentialsFromPostgres } from "../src/git-integration/gitCredentialsStore";
import { getInstallation, getInstallationAccessToken } from "../src/integrations/git/githubApp";
import { evaluateGithubAppPermissions } from "../src/integrations/git/githubAppPermissions";
import { prisma } from "../src/db/client";
import { TEST_REPO_BRANCH, TEST_REPO_NAME, TEST_REPO_OWNER } from "./testRepoConfig";

async function main() {
  await restoreGitCredentialsFromPostgres();
  const install = await prisma.githubInstallation.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!install) {
    console.log("No GitHub installation in DB");
    process.exit(1);
  }

  console.log("Installation ID:", install.installationId);
  console.log("Account:", install.accountLogin, `(${install.accountType})`);
  console.log("DB selected repo:", `${install.selectedRepoOwner}/${install.selectedRepoName}`);
  console.log("Test target repo:", `${TEST_REPO_OWNER}/${TEST_REPO_NAME} @ ${TEST_REPO_BRANCH}`);

  const meta = await getInstallation(install.installationId);
  const appSlug = process.env.GITHUB_APP_SLUG?.trim() ?? null;
  const permCheck = evaluateGithubAppPermissions(meta.permissions, appSlug);
  console.log("App permissions:", JSON.stringify(meta.permissions));
  console.log("Required permissions:", JSON.stringify(permCheck.required));
  if (!permCheck.ok) {
    console.log("MISSING:", permCheck.missing.join(", "));
    if (permCheck.fixUrl) console.log("Fix URL:", permCheck.fixUrl);
  }

  const token = await getInstallationAccessToken(install.installationId);
  const owner = TEST_REPO_OWNER;
  const name = TEST_REPO_NAME;

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const repoBody = await repoRes.json();
  console.log("Repo API:", repoRes.status, repoBody.permissions ?? repoBody.message);

  // Try creating a ref (write test without leaving a branch if we delete after)
  const testBranch = `agentos/perm-check-${Date.now()}`;
  const baseRef = await fetch(
    `https://api.github.com/repos/${owner}/${name}/git/ref/heads/${TEST_REPO_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  const baseData = await baseRef.json();
  if (!baseRef.ok) {
    console.log("Cannot read base ref:", baseRef.status, baseData.message);
    process.exit(1);
  }

  const createRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: `refs/heads/${testBranch}`, sha: baseData.object.sha }),
  });
  const createBody = await createRes.json();
  console.log("Create branch API:", createRes.status, createRes.ok ? testBranch : createBody.message);

  if (createRes.ok) {
    await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(testBranch)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    console.log("Write test: PASS (branch create + delete)");
  } else {
    console.log("Write test: FAIL");
    if (!permCheck.ok) {
      console.log(
        "Update GitHub App → Permissions → Contents to Read and write, then accept on installation."
      );
    }
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
