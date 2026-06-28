/**
 * Layer-by-layer Ananta probe against sudesh_anna_test (GitHub).
 * Usage: npx tsx scripts/ananta-layer-probe.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  destroyEngWorkspace,
  registerEngWorkspaceLocal,
  workspaceListDir,
  workspaceReadFile,
} from "../src/engineering/engineeringWorkspace";
import { buildEngineeringCodingInitialUserMessage } from "../src/engineeringCodingAgent/inputBuilder";
import { executeEngineeringCodingToolCall } from "../src/tools/engineeringCodingToolExecutor";
import { validateImplementation } from "../src/validators/implementationValidator";
import type { ImplementationOutput, PrdOutput } from "../src/types/agents";

/** Empty pipelineId skips auditRepo DB writes (tool-layer isolation). */
const PIPELINE_ID = "";
const JIRA_KEY = "DEMO-LAYER-1";
const REPO_URL = "https://github.com/Sudesha-agentos/sudesh_anna_test.git";
const REPO_BRANCH = "test";
const TARGET_FILE = "src/lib/utils.ts";

const prd: PrdOutput = {
  title: "Add truncateText utility",
  problemStatement: "UI components need a shared helper to shorten long strings for display.",
  proposedSolution:
    "Export truncateText(text, maxLength) from src/lib/utils.ts — returns original text when short, otherwise slices and appends an ellipsis.",
  userStories: ["As a developer I want truncateText so labels don't overflow cards"],
  acceptanceCriteria: [
    "Given text shorter than maxLength When truncateText is called Then it returns the full text",
    "Given text longer than maxLength When truncateText is called Then it returns a truncated string with ellipsis",
    "Given maxLength <= 0 When truncateText is called Then it returns empty string",
    "Function is exported from src/lib/utils.ts",
  ],
  outOfScope: ["UI component changes"],
  edgeCases: ["empty string", "maxLength zero"],
  dependencies: [],
  successMetrics: ["tsc passes"],
  openQuestions: [],
  confidenceScore: 0.95,
  confidenceReason: "Single-file pure function",
};

const implementation: ImplementationOutput = {
  summary: "Add truncateText to src/lib/utils.ts",
  technicalApproach: "Pure string helper alongside existing cn() export",
  components: [
    {
      name: "truncateText",
      description: "Truncate strings with ellipsis",
      estimatedDays: 0.1,
    },
  ],
  apiChanges: [],
  databaseChanges: [],
  dependencies: [],
  risks: [],
  totalEstimateDays: 0.1,
  criteriaMapping: [
    {
      criterion: "Given text shorter than maxLength When truncateText is called Then it returns the full text",
      implementation: "return text when text.length <= maxLength",
    },
    {
      criterion: "Given text longer than maxLength When truncateText is called Then it returns a truncated string with ellipsis",
      implementation: "slice(0, maxLength) + ellipsis",
    },
    {
      criterion: "Given maxLength <= 0 When truncateText is called Then it returns empty string",
      implementation: "return empty string for non-positive maxLength",
    },
    {
      criterion: "Function is exported from src/lib/utils.ts",
      implementation: "export truncateText from utils.ts",
    },
  ],
  blockers: [],
  confidenceScore: 0.95,
  confidenceReason: "Trivial utility addition",
  targetFiles: [TARGET_FILE],
  implementationMode: "code",
};

const GOLDEN_SNIPPET = `
export function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}`.trim();

type LayerResult = {
  layer: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  expected: string;
  actual: string;
  notes?: string;
};

const results: LayerResult[] = [];

function record(
  layer: string,
  status: LayerResult["status"],
  expected: string,
  actual: string,
  notes?: string
): void {
  results.push({ layer, status, expected, actual, notes });
  const icon = { PASS: "✓", FAIL: "✗", SKIP: "—", WARN: "!" }[status];
  console.log(`\n[${icon}] ${layer}`);
  console.log(`  Expected: ${expected}`);
  console.log(`  Actual:   ${actual}`);
  if (notes) console.log(`  Notes:    ${notes}`);
}

function prepareSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), "ananta-layer-"));
  execSync(`git clone --depth 1 --branch ${REPO_BRANCH} ${REPO_URL} .`, {
    cwd: sandbox,
    stdio: "pipe",
    timeout: 120_000,
  });
  execSync("git config user.email probe@agentos.ai", { cwd: sandbox, stdio: "ignore" });
  execSync("git config user.name Probe", { cwd: sandbox, stdio: "ignore" });
  return sandbox;
}

async function probeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ content: string; isError: boolean; resultsFound?: number }> {
  const result = await executeEngineeringCodingToolCall(
    { name, input, toolUseId: `probe-${name}` },
    PIPELINE_ID,
    JIRA_KEY
  );
  return {
    content: result.content,
    isError: result.isError ?? false,
    resultsFound: result.meta?.resultsFound,
  };
}

async function main() {
  console.log("=== Ananta layer probe ===");
  console.log(`Repo: ${REPO_URL} @ ${REPO_BRANCH}`);
  console.log(`Ticket: ${JIRA_KEY}`);
  console.log(`Target: ${TARGET_FILE}`);
  console.log(`Platform: ${process.platform}`);

  const workspaceDir = prepareSandbox();
  registerEngWorkspaceLocal(PIPELINE_ID, JIRA_KEY, workspaceDir, REPO_BRANCH);

  try {
    const userMessage = buildEngineeringCodingInitialUserMessage({
      pipelineId: PIPELINE_ID,
      jiraKey: JIRA_KEY,
      prd,
      implementation,
      enrichedPrdDocument: {},
      branchName: REPO_BRANCH,
      implementationMode: "code",
    });
    const hasTarget = userMessage.includes(TARGET_FILE);
    const hasFunctionName = userMessage.includes("truncateText");
    record(
      "L2 — Input builder",
      hasTarget && hasFunctionName ? "PASS" : "FAIL",
      `Prompt mentions ${TARGET_FILE} and truncateText`,
      `targetFile=${hasTarget}, functionName=${hasFunctionName}`
    );

    const listRoot = await probeTool("list_dir", { dir_path: "." });
    const rootHasSrc =
      listRoot.content.includes("src/") || listRoot.content.includes('"src"');
    record(
      "L4 — list_dir(.)",
      rootHasSrc && !listRoot.isError ? "PASS" : "FAIL",
      "Root listing includes src/",
      listRoot.isError ? `error: ${listRoot.content.slice(0, 120)}` : "src/ present"
    );

    let listSubOk = false;
    let listSubMsg = "";
    try {
      const entries = workspaceListDir(workspaceDir, "src/lib");
      listSubOk = entries.some((e) => e.includes("utils.ts"));
      listSubMsg = entries.join(", ");
    } catch (err) {
      listSubMsg = err instanceof Error ? err.message : String(err);
    }
    record(
      "L4 — list_dir(src/lib) [direct]",
      listSubOk ? "PASS" : "FAIL",
      "Lists utils.ts",
      listSubMsg
    );

    const listSubTool = await probeTool("list_dir", { dir_path: "src/lib" });
    record(
      "L4 — list_dir(subdir) [tool executor]",
      !listSubTool.isError && (listSubTool.resultsFound ?? 0) > 0 ? "PASS" : "FAIL",
      "Tool returns entries without isError",
      listSubTool.isError
        ? `isError=true: ${listSubTool.content.slice(0, 120)}`
        : `${listSubTool.resultsFound ?? 0} entries`
    );

    const readDirectOk = (() => {
      try {
        return workspaceReadFile(workspaceDir, TARGET_FILE).includes("export function cn");
      } catch {
        return false;
      }
    })();
    record(
      "L4 — read_file [direct]",
      readDirectOk ? "PASS" : "FAIL",
      "Reads utils.ts with cn export",
      readDirectOk ? "content OK" : "read failed"
    );

    const readTool = await probeTool("read_file", { file_path: TARGET_FILE });
    const readToolOk = !readTool.isError && readTool.content.includes("export function cn");
    record(
      "L4 — read_file [tool executor]",
      readToolOk ? "PASS" : "FAIL",
      "Returns file content from workspace",
      readToolOk ? "content OK" : readTool.content.slice(0, 160)
    );

    const grepTool = await probeTool("grep", {
      pattern: "export function cn",
      file_glob: "*.ts",
    });
    record(
      "L4 — grep",
      (grepTool.resultsFound ?? 0) > 0 ? "PASS" : "FAIL",
      "≥1 match for cn export",
      `hits=${grepTool.resultsFound ?? 0}`
    );

    const searchTool = await probeTool("search_codebase", {
      query: "truncate text utility utils",
    });
    record(
      "L4 — search_codebase",
      (searchTool.resultsFound ?? 0) > 0 ? "PASS" : "WARN",
      "Returns candidate files from index",
      `hits=${searchTool.resultsFound ?? 0}`,
      (searchTool.resultsFound ?? 0) === 0
        ? "Index may be empty without GitHub org config — non-fatal when targetFiles are set"
        : undefined
    );

    let editOk = false;
    try {
      const baseline = workspaceReadFile(workspaceDir, TARGET_FILE);
      const cnMatch = baseline.match(
        /export function cn\([\s\S]*?\n\}/
      );
      if (cnMatch) {
        const anchor = cnMatch[0];
        await probeTool("edit_file", {
          file_path: TARGET_FILE,
          old_string: anchor,
          new_string: `${anchor}\n\n${GOLDEN_SNIPPET}`,
          summary: "Add truncateText",
        });
        editOk = workspaceReadFile(workspaceDir, TARGET_FILE).includes("truncateText");
      }
    } catch {
      editOk = false;
    }
    record(
      "L4 — edit_file (golden patch)",
      editOk ? "PASS" : "FAIL",
      "File contains truncateText after edit",
      editOk ? "patched OK" : "edit failed"
    );

    if (editOk) {
      if (!existsSync(join(workspaceDir, "node_modules"))) {
        record(
          "L4 — verify (tsc)",
          "SKIP",
          "npx tsc --noEmit after npm install",
          "node_modules not installed in probe sandbox",
          "Run ananta-demo-harness.ts for full install + agent verify"
        );
      } else {
        try {
          execSync("npx tsc --noEmit", {
            cwd: workspaceDir,
            encoding: "utf8",
            stdio: "pipe",
            timeout: 180_000,
          });
          record("L4 — verify (tsc)", "PASS", "npx tsc --noEmit exits 0", "passed");
        } catch (err) {
          const e = err as { stdout?: string; stderr?: string };
          record(
            "L4 — verify (tsc)",
            "FAIL",
            "tsc passes after golden edit",
            (e.stderr ?? e.stdout ?? String(err)).slice(0, 300)
          );
        }
      }
    }

    const implValidation = validateImplementation(implementation, prd, {
      implementationMode: "code",
      targetFiles: implementation.targetFiles,
    });
    record(
      "L7 — IMPLEMENTATION_VALIDATION",
      implValidation.passed ? "PASS" : "FAIL",
      "Plan validates against PRD",
      implValidation.passed
        ? `score=${implValidation.score}`
        : implValidation.issues.map((i) => i.message).join("; ")
    );

    const orchestratorSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/pipeline/orchestrator.ts"),
      "utf8"
    );
    const hasCodeGate = orchestratorSource.includes(
      "Code implementation required at least one file change"
    );
    record(
      "L6 — Zero-file gate (code mode)",
      hasCodeGate ? "PASS" : "FAIL",
      "Orchestrator throws when no file changes in code mode",
      hasCodeGate ? "gate present" : "missing"
    );

    if (!process.env.OPENAI_API_KEY?.trim()) {
      record(
        "L0/L3 — LLM layers",
        "SKIP",
        "Planning + agentic loop",
        "OPENAI_API_KEY not set",
        "Run ananta-demo-harness.ts with API key for full agent test"
      );
    } else {
      record("L0/L3 — LLM layers", "SKIP", "Full agent", "Use ananta-demo-harness.ts");
    }

    console.log("\n=== SUMMARY ===");
    const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
    for (const r of results) counts[r.status] += 1;
    console.log(
      `PASS=${counts.PASS} FAIL=${counts.FAIL} WARN=${counts.WARN} SKIP=${counts.SKIP}`
    );

    if (results.some((r) => r.status === "FAIL")) {
      process.exitCode = 1;
    }
  } finally {
    destroyEngWorkspace(PIPELINE_ID);
    if (existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
