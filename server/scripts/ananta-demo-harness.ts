/**
 * Ananta coding-agent benchmark against sudesh_anna_test.
 * Usage: npx tsx scripts/ananta-demo-harness.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  destroyEngWorkspace,
  registerEngWorkspaceLocal,
} from "../src/engineering/engineeringWorkspace";
import { runEngineeringCodingAgentic } from "../src/engineeringCodingAgent";
import type { ImplementationOutput, PrdOutput } from "../src/types/agents";

const PIPELINE_ID = "";
const JIRA_KEY = "DEMO-99";
const REPO_URL = "https://github.com/Sudesha-agentos/sudesh_anna_test.git";
const REPO_BRANCH = "test";
const TARGET_FILE = "src/lib/utils.ts";

const prd: PrdOutput = {
  title: "Add truncateText utility",
  problemStatement: "UI needs a shared helper to shorten long strings for display.",
  proposedSolution:
    "Export truncateText(text, maxLength) from src/lib/utils.ts with ellipsis when truncated.",
  userStories: ["As a developer I want truncateText for card labels"],
  acceptanceCriteria: [
    "Given text shorter than maxLength When truncateText is called Then it returns the full text",
    "Given text longer than maxLength When truncateText is called Then it returns truncated text with ellipsis",
    "Given maxLength <= 0 When truncateText is called Then it returns empty string",
    "Function exported from src/lib/utils.ts",
  ],
  outOfScope: ["UI changes"],
  edgeCases: ["empty string"],
  dependencies: [],
  successMetrics: ["tsc passes"],
  openQuestions: [],
  confidenceScore: 0.9,
  confidenceReason: "Small pure function",
};

const implementation: ImplementationOutput = {
  summary: "Add truncateText to src/lib/utils.ts",
  technicalApproach: "Pure helper next to cn()",
  components: [
    {
      name: "truncateText",
      description: "String truncation with ellipsis",
      estimatedDays: 0.1,
    },
  ],
  apiChanges: [],
  databaseChanges: [],
  dependencies: [],
  risks: [],
  totalEstimateDays: 0.1,
  criteriaMapping: [
    { criterion: "short text unchanged", implementation: "length check" },
    { criterion: "long text truncated", implementation: "slice + ellipsis" },
    { criterion: "maxLength <= 0", implementation: "return empty string" },
  ],
  blockers: [],
  confidenceScore: 0.9,
  confidenceReason: "Trivial change",
  targetFiles: [TARGET_FILE],
  implementationMode: "code",
};

function prepareSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), "ananta-demo-"));
  execSync(`git clone --depth 1 --branch ${REPO_BRANCH} ${REPO_URL} .`, {
    cwd: sandbox,
    stdio: "pipe",
    timeout: 120_000,
  });
  execSync("git config user.email demo@agentos.ai", { cwd: sandbox, stdio: "ignore" });
  execSync("git config user.name Demo", { cwd: sandbox, stdio: "ignore" });
  console.log("Installing dependencies (first run may take a few minutes)...");
  execSync("npm install", { cwd: sandbox, stdio: "pipe", timeout: 600_000 });
  return sandbox;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY required");
    process.exit(1);
  }

  const workspaceDir = prepareSandbox();
  console.log("Workspace:", workspaceDir);
  console.log("Repo:", REPO_URL, "@", REPO_BRANCH);

  registerEngWorkspaceLocal(PIPELINE_ID, JIRA_KEY, workspaceDir, REPO_BRANCH);

  const started = Date.now();
  try {
    const result = await runEngineeringCodingAgentic({
      pipelineId: PIPELINE_ID,
      jiraKey: JIRA_KEY,
      prd,
      implementation,
      enrichedPrdDocument: {},
      implementationMode: "code",
      retainArtifacts: true,
    });

    console.log("\n=== ANANTA RESULT ===");
    console.log("Duration ms:", Date.now() - started);
    console.log("Tool calls:", result.toolCallLog.length);
    console.log("Summary:", result.codingSummary);
    console.log("Code changes:", JSON.stringify(result.codeChanges, null, 2));
    console.log("Metadata:", result.metadata);
    console.log("\nTool log:");
    for (const t of result.toolCallLog) {
      console.log(`  ${t.tool} | ${t.query} | hits=${t.resultsFound}`);
    }

    const utilsPath = join(workspaceDir, TARGET_FILE);
    if (existsSync(utilsPath)) {
      console.log("\n=== utils.ts (sandbox) ===");
      console.log(readFileSync(utilsPath, "utf8"));
    }

    try {
      execSync("npx tsc --noEmit", {
        cwd: workspaceDir,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 180_000,
      });
      console.log("\nTypecheck: PASSED");
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      console.log("\nTypecheck: FAILED");
      console.log(e.stdout ?? e.stderr ?? String(err));
    }
  } finally {
    destroyEngWorkspace(PIPELINE_ID);
    rmSync(workspaceDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
