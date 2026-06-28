/**
 * Test Ananta per-ticket branch: name → workspace → commit → push → GitHub verify.
 * Usage: npx tsx scripts/ananta-branch-test.ts [JIRA-KEY]
 * Example: npx tsx scripts/ananta-branch-test.ts AG-61
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { prisma } from "../src/db/client";
import { saveGitCredentials } from "../src/git-integration/gitCredentialsStore";
import { gitClient } from "../src/integrations/gitProvider";
import {
  createEngWorkspace,
  destroyEngWorkspace,
  resolveEngineeringBranchName,
  sanitizeBranchSegment,
  workspaceCommitAndPush,
  workspaceWriteFile,
} from "../src/engineering/engineeringWorkspace";
import { TEST_REPO_BRANCH, TEST_REPO_NAME, TEST_REPO_OWNER } from "./testRepoConfig";

const JIRA_KEY = process.argv[2]?.trim() || "AG-61";
const PIPELINE_ID = `branch-test-${Date.now()}`;

async function loadPatCredentials(): Promise<void> {
  const envToken = process.env.GITHUB_TOKEN?.trim();
  if (envToken) {
    saveGitCredentials({
      provider: "github",
      workspace: process.env.GITHUB_REPO_OWNER?.trim() || TEST_REPO_OWNER,
      repoSlug: process.env.GITHUB_REPO_NAME?.trim() || TEST_REPO_NAME,
      token: envToken,
      authMethod: "pat",
      defaultBranch: TEST_REPO_BRANCH,
      installationId: null,
    });
    return;
  }

  const rows = (await prisma.$queryRawUnsafe(`
    SELECT workspace, "repoSlug", token, "defaultBranch"
    FROM "OrganizationGitConfig"
    WHERE token <> '' AND "authMethod" = 'pat'
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `)) as Array<{
    workspace: string;
    repoSlug: string;
    token: string;
    defaultBranch: string;
  }>;

  const row = rows.find(
    (r) => r.workspace === TEST_REPO_OWNER && r.repoSlug === TEST_REPO_NAME
  ) ?? rows[0];

  if (!row?.token) {
    throw new Error("No PAT in env or OrganizationGitConfig — connect manual token first.");
  }

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

function gitHeadBranch(workspaceDir: string): string {
  return execSync("git rev-parse --abbrev-ref HEAD", {
    cwd: workspaceDir,
    encoding: "utf8",
  }).trim();
}

async function branchExistsOnGitHub(branchName: string): Promise<boolean> {
  try {
    await gitClient.getFileContent("README.md", branchName);
    return true;
  } catch {
    try {
      const token = process.env.GITHUB_TOKEN;
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT token FROM "OrganizationGitConfig"
        WHERE token <> '' AND "authMethod" = 'pat'
        ORDER BY "updatedAt" DESC LIMIT 1
      `)) as Array<{ token: string }>;
      const bearer = token || rows[0]?.token;
      if (!bearer) return false;
      const res = await fetch(
        `https://api.github.com/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/git/ref/heads/${encodeURIComponent(branchName)}`,
        {
          headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}

type StepResult = { step: string; status: "PASS" | "FAIL"; detail: string };

async function main() {
  const results: StepResult[] = [];
  const expectedBranch = resolveEngineeringBranchName(JIRA_KEY);
  const expectedSegment = sanitizeBranchSegment(JIRA_KEY);

  console.log("=== Ananta per-ticket branch test ===\n");
  console.log(`Jira key:         ${JIRA_KEY}`);
  console.log(`Expected branch:  ${expectedBranch}`);
  console.log(`Sanitized segment: ${expectedSegment}`);
  console.log(`Repo:             ${TEST_REPO_OWNER}/${TEST_REPO_NAME} @ ${TEST_REPO_BRANCH}\n`);

  if (process.env.ENGINEERING_TARGET_BRANCH?.trim()) {
    console.warn(
      `WARN: ENGINEERING_TARGET_BRANCH=${process.env.ENGINEERING_TARGET_BRANCH} overrides per-ticket naming`
    );
  }

  await loadPatCredentials();

  // Step 1 — branch name resolution
  if (expectedBranch === `agentos/${expectedSegment}` || process.env.ENGINEERING_TARGET_BRANCH) {
    results.push({
      step: "1. Branch name resolution",
      status: "PASS",
      detail: `resolveEngineeringBranchName → ${expectedBranch}`,
    });
  } else {
    results.push({
      step: "1. Branch name resolution",
      status: "FAIL",
      detail: `Expected agentos/${expectedSegment}, got ${expectedBranch}`,
    });
  }

  let workspace;
  try {
    // Step 2 — workspace + local branch (same as orchestrator createEngWorkspace)
    console.log("2. Creating engineering workspace...");
    workspace = await createEngWorkspace(PIPELINE_ID, JIRA_KEY, TEST_REPO_BRANCH);
    const headBranch = gitHeadBranch(workspace.workspaceDir);

    const branchOk =
      workspace.branchName === expectedBranch && headBranch === expectedBranch;
    results.push({
      step: "2. Local branch checkout",
      status: branchOk ? "PASS" : "FAIL",
      detail: `handle.branchName=${workspace.branchName}, git HEAD=${headBranch}`,
    });

    // Step 3 — write + commit + push (orchestrator tail)
    const marker = `.agentos-branch-test-${JIRA_KEY.toLowerCase()}-${Date.now()}.txt`;
    console.log("3. Writing, committing, pushing...");
    workspaceWriteFile(
      workspace.workspaceDir,
      marker,
      `Ananta branch test for ${JIRA_KEY}\nBranch: ${expectedBranch}\n`
    );
    const pushResult = await workspaceCommitAndPush(
      workspace.workspaceDir,
      `[${JIRA_KEY}] Ananta branch test`
    );

    if (pushResult?.pushedBranch === expectedBranch) {
      results.push({
        step: "3. Commit & push",
        status: "PASS",
        detail: `sha=${pushResult.sha.slice(0, 12)} branch=${pushResult.pushedBranch}`,
      });
    } else {
      results.push({
        step: "3. Commit & push",
        status: "FAIL",
        detail: pushResult
          ? `pushed ${pushResult.pushedBranch}, expected ${expectedBranch}`
          : "push returned null (nothing to commit?)",
      });
    }

    // Step 4 — verify remote branch on GitHub
    console.log("4. Verifying branch on GitHub...");
    const remoteOk = await branchExistsOnGitHub(expectedBranch);
    results.push({
      step: "4. Remote branch on GitHub",
      status: remoteOk ? "PASS" : "FAIL",
      detail: remoteOk
        ? `ref heads/${expectedBranch} exists`
        : `branch not found on remote`,
    });

    if (pushResult) {
      const remote = await gitClient.getFileContent(marker, pushResult.pushedBranch);
      const contentOk = remote.content.includes(JIRA_KEY);
      results.push({
        step: "5. File on pushed branch",
        status: contentOk ? "PASS" : "FAIL",
        detail: contentOk ? `${marker} readable on remote` : "file content mismatch",
      });
    }
  } catch (err) {
    results.push({
      step: "workspace/push",
      status: "FAIL",
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    destroyEngWorkspace(PIPELINE_ID);
  }

  console.log("\n--- Results ---");
  let allPass = true;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : "✗";
    console.log(`[${icon}] ${r.step}: ${r.detail}`);
    if (r.status === "FAIL") allPass = false;
  }

  if (allPass) {
    console.log(`\n=== PASS ===`);
    console.log(
      `https://github.com/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/tree/${encodeURIComponent(expectedBranch)}`
    );
  } else {
    console.log("\n=== FAIL ===");
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
