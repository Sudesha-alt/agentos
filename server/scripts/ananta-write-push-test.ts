/**
 * End-to-end: workspace + write_file tool + commit + push (no LLM).
 * Usage: npx tsx scripts/ananta-write-push-test.ts
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { prisma } from "../src/db/client";
import { saveGitCredentials } from "../src/git-integration/gitCredentialsStore";
import { gitClient } from "../src/integrations/gitProvider";
import {
  setCodingDeliverablePaths,
  clearCodingArtifacts,
} from "../src/engineering/codingArtifactStore";
import {
  createEngWorkspace,
  destroyEngWorkspace,
  resolveEngineeringBranchName,
  workspaceCommitAndPush,
} from "../src/engineering/engineeringWorkspace";
import { TEST_REPO_BRANCH, TEST_REPO_NAME, TEST_REPO_OWNER } from "./testRepoConfig";

const JIRA_KEY = "WRITE-PUSH-TEST";
const PIPELINE_ID = `write-push-${Date.now()}`;
const DELIVERABLE = "docs/ananta-smoke-test.md";

async function loadCredentials(): Promise<void> {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT workspace, "repoSlug", token, "defaultBranch"
    FROM "OrganizationGitConfig"
    WHERE token <> '' AND "authMethod" = 'pat'
    ORDER BY "updatedAt" DESC LIMIT 1
  `)) as Array<{ workspace: string; repoSlug: string; token: string; defaultBranch: string }>;

  const row = rows.find(
    (r) => r.workspace === TEST_REPO_OWNER && r.repoSlug === TEST_REPO_NAME
  ) ?? rows[0];
  if (!row?.token) throw new Error("No PAT configured");

  saveGitCredentials({
    provider: "github",
    workspace: row.workspace,
    repoSlug: row.repoSlug,
    token: row.token,
    authMethod: "pat",
    defaultBranch: row.defaultBranch || TEST_REPO_BRANCH,
    installationId: null,
  });
}

async function main() {
  console.log("=== Ananta write_file + push test ===\n");
  console.log(`Repo: ${TEST_REPO_OWNER}/${TEST_REPO_NAME} @ ${TEST_REPO_BRANCH}`);
  console.log(`Branch: ${resolveEngineeringBranchName(JIRA_KEY)}`);
  console.log(`File: ${DELIVERABLE}\n`);

  await loadCredentials();
  clearCodingArtifacts(PIPELINE_ID);
  setCodingDeliverablePaths(PIPELINE_ID, [DELIVERABLE]);

  let workspace;
  try {
    console.log("1. Creating workspace...");
    workspace = await createEngWorkspace(PIPELINE_ID, JIRA_KEY, TEST_REPO_BRANCH, {
      skipDependencyInstall: true,
    });
    console.log("   OK\n");

    console.log("2. write_file path inference + workspace write...");
    const { resolveWriteTargetPath } = await import("../src/engineering/codingArtifactStore");
    const { workspaceWriteFile } = await import("../src/engineering/engineeringWorkspace");
    const resolved = resolveWriteTargetPath(PIPELINE_ID, {
      content: `# Ananta smoke test\n\nGenerated: ${new Date().toISOString()}\n`,
      summary: "Basic Ananta write_file smoke test",
    });
    if (!resolved) {
      console.error("   FAIL: could not resolve write path");
      process.exit(1);
    }
    console.log(`   inferred path: ${resolved.filePath} (inferred=${resolved.inferred})`);
    workspaceWriteFile(
      workspace!.workspaceDir,
      resolved.filePath,
      `# Ananta smoke test\n\nGenerated: ${new Date().toISOString()}\n`
    );
    console.log("   OK\n");

    console.log("3. Committing and pushing...");
    const push = await workspaceCommitAndPush(
      workspace.workspaceDir,
      `[${JIRA_KEY}] Ananta write_file smoke test`
    );
    if (!push) {
      console.error("   FAIL: nothing to commit");
      process.exit(1);
    }
    console.log(`   OK — branch=${push.pushedBranch} sha=${push.sha.slice(0, 12)}\n`);

    console.log("4. Verifying on GitHub...");
    const remote = await gitClient.getFileContent(DELIVERABLE, push.pushedBranch);
    if (!remote.content.includes("Ananta smoke test")) {
      console.error("   FAIL: content mismatch");
      process.exit(1);
    }
    console.log(`   OK — ${remote.path} (${remote.size} bytes)\n`);

    console.log("=== PASS ===");
    console.log(
      `https://github.com/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/blob/${encodeURIComponent(push.pushedBranch)}/${DELIVERABLE}`
    );
  } finally {
    destroyEngWorkspace(PIPELINE_ID);
    clearCodingArtifacts(PIPELINE_ID);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
