/**
 * Smoke test: clone → branch → commit → push (same path as production Ananta).
 * Prefers PAT from org git config or env; falls back to GitHub App installation.
 * Usage: npx tsx scripts/ananta-push-smoke.ts
 */
import "dotenv/config";
import {
  getRepoContext,
  restoreGitCredentialsFromPostgres,
  saveGitCredentials,
} from "../src/git-integration/gitCredentialsStore";
import { getInstallationAccessToken } from "../src/integrations/git/githubApp";
import { gitClient } from "../src/integrations/gitProvider";
import { prisma } from "../src/db/client";
import { TEST_REPO_BRANCH, TEST_REPO_NAME, TEST_REPO_OWNER } from "./testRepoConfig";
import {
  createEngWorkspace,
  destroyEngWorkspace,
  workspaceCommitAndPush,
  workspaceWriteFile,
} from "../src/engineering/engineeringWorkspace";
import { resolveEngineeringBranchName } from "../src/engineering/engineeringWorkspace";

const PIPELINE_ID = `push-smoke-${Date.now()}`;
const JIRA_KEY = "PUSH-SMOKE";

async function resolveTestCredentials(): Promise<{
  authMethod: "pat" | "github_app";
  source: string;
}> {
  const envToken = process.env.GITHUB_TOKEN?.trim();
  const envOwner = process.env.GITHUB_REPO_OWNER?.trim() || TEST_REPO_OWNER;
  const envRepo = process.env.GITHUB_REPO_NAME?.trim() || TEST_REPO_NAME;
  const envBranch =
    process.env.GIT_DEFAULT_BRANCH?.trim() ||
    process.env.GITHUB_DEFAULT_BRANCH?.trim() ||
    TEST_REPO_BRANCH;

  if (envToken) {
    saveGitCredentials({
      provider: "github",
      workspace: envOwner,
      repoSlug: envRepo,
      token: envToken,
      authMethod: "pat",
      defaultBranch: envBranch,
      installationId: null,
    });
    return { authMethod: "pat", source: "env GITHUB_TOKEN" };
  }

  try {
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT "organizationId", workspace, "repoSlug", "authMethod", "defaultBranch", token
      FROM "OrganizationGitConfig"
      WHERE token <> ''
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `)) as Array<{
      organizationId: string;
      workspace: string;
      repoSlug: string;
      authMethod: string;
      defaultBranch: string;
      token: string;
    }>;

    for (const row of rows) {
      const usePat = row.authMethod === "pat" || Boolean(row.token);
      if (!usePat) continue;

      saveGitCredentials({
        provider: "github",
        workspace: row.workspace || TEST_REPO_OWNER,
        repoSlug: row.repoSlug || TEST_REPO_NAME,
        token: row.token,
        authMethod: "pat",
        defaultBranch: row.defaultBranch || TEST_REPO_BRANCH,
        installationId: null,
      });
      const matchesTestRepo =
        row.workspace === TEST_REPO_OWNER && row.repoSlug === TEST_REPO_NAME;
      return {
        authMethod: "pat",
        source: `org git config (${row.organizationId})${matchesTestRepo ? "" : " — repo differs from test default"}`,
      };
    }
  } catch (err) {
    console.warn(
      "Could not load org PAT config:",
      err instanceof Error ? err.message : err
    );
  }

  const restored = await restoreGitCredentialsFromPostgres();
  if (!restored) {
    throw new Error(
      "No PAT in env or org config, and no GitHub App installation in Postgres."
    );
  }

  const install = await prisma.githubInstallation.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!install?.installationId) {
    throw new Error("No GitHub App installation found.");
  }

  const token = await getInstallationAccessToken(install.installationId);
  saveGitCredentials({
    provider: "github",
    workspace: TEST_REPO_OWNER,
    repoSlug: TEST_REPO_NAME,
    token,
    authMethod: "github_app",
    installationId: install.installationId,
    defaultBranch: TEST_REPO_BRANCH,
  });
  return {
    authMethod: "github_app",
    source: `GitHub App installation ${install.installationId} (${install.accountLogin})`,
  };
}

async function main() {
  console.log("=== Ananta push smoke test ===\n");

  let auth: { authMethod: "pat" | "github_app"; source: string };
  try {
    auth = await resolveTestCredentials();
  } catch (err) {
    console.error("FAIL:", err instanceof Error ? err.message : err);
    console.error(
      "Set PAT via AgentOS Git Integration UI, or GITHUB_TOKEN in server/.env"
    );
    process.exit(1);
  }

  let ctx: ReturnType<typeof getRepoContext>;
  try {
    ctx = getRepoContext();
  } catch (err) {
    console.error("FAIL: No repo context:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const sourceBranch = TEST_REPO_BRANCH || ctx.defaultBranch || "test";
  const targetBranch = resolveEngineeringBranchName(JIRA_KEY);

  console.log(`Auth:     ${auth.authMethod} (${auth.source})`);
  console.log(`Repo:     ${ctx.workspace}/${ctx.repoSlug}`);
  console.log(`Source:   ${sourceBranch}`);
  console.log(`Target:   ${targetBranch}`);
  console.log(`Pipeline: ${PIPELINE_ID}\n`);

  let workspace;
  try {
    console.log("1. Creating workspace (clone + branch)...");
    workspace = await createEngWorkspace(PIPELINE_ID, JIRA_KEY, sourceBranch);
    console.log(`   OK — workspace at ${workspace.workspaceDir}`);
    console.log(`   Branch: ${workspace.branchName}\n`);

    const testPath = `.agentos-push-smoke-${Date.now()}.txt`;
    const testContent = `Ananta push smoke test\nTimestamp: ${new Date().toISOString()}\n`;
    console.log(`2. Writing test file: ${testPath}`);
    workspaceWriteFile(workspace.workspaceDir, testPath, testContent);
    console.log("   OK\n");

    console.log("3. Committing and pushing...");
    const pushResult = await workspaceCommitAndPush(
      workspace.workspaceDir,
      `[${JIRA_KEY}] push smoke test`
    );

    if (!pushResult) {
      console.error("FAIL: workspaceCommitAndPush returned null (nothing to commit?)");
      process.exit(1);
    }

    console.log(`   OK — pushed branch=${pushResult.pushedBranch} sha=${pushResult.sha.slice(0, 12)}\n`);

    console.log("4. Verifying file on GitHub...");
    const remote = await gitClient.getFileContent(testPath, pushResult.pushedBranch);
    const verified = remote.content.trim().includes("Ananta push smoke test");
    if (!verified) {
      console.error("FAIL: File on GitHub does not match expected content");
      process.exit(1);
    }
    console.log(`   OK — read back ${remote.path} (${remote.size} bytes)\n`);

    console.log("=== RESULT: PASS ===");
    console.log(
      `View branch: https://github.com/${ctx.workspace}/${ctx.repoSlug}/tree/${encodeURIComponent(pushResult.pushedBranch)}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n=== RESULT: FAIL ===");
    console.error(msg);
    if (msg.includes("403") || msg.includes("401")) {
      console.error(
        "\nLikely cause: token lacks push permission, wrong repo, or still using GitHub App bot."
      );
      if (auth.authMethod === "github_app") {
        console.error("Use Manual token (PAT) in AgentOS Git Integration for push.");
      }
    }
    process.exit(1);
  } finally {
    destroyEngWorkspace(PIPELINE_ID);
  }
}

main();
