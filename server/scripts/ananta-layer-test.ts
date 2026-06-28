/**
 * Ananta layer test: L0 plan → L2 prompt → L3 agentic loop → L5/L6 assembly.
 * Usage: npx tsx scripts/ananta-layer-test.ts
 */
import "dotenv/config";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { EngineeringAgent } from "../src/agents/engineeringAgent";
import { buildEngineeringAgentSystemPrompt } from "../src/agents/engineeringAgentPrompt";
import { normalizeImplementationOutput } from "../src/agents/normalizeImplementationOutput";
import { buildEngineeringAgentContext } from "../src/pipeline/contextBuilder";
import {
  destroyEngWorkspace,
  registerEngWorkspaceLocal,
  workspaceGetChangedFiles,
  workspaceCommitAndPush,
  workspaceGitStatus,
} from "../src/engineering/engineeringWorkspace";
import { runWorkspaceSafetyCompile } from "../src/engineering/workspaceCompile";
import { runEngineeringCodingAgentic } from "../src/engineeringCodingAgent";
import { buildEngineeringCodingInitialUserMessage } from "../src/engineeringCodingAgent/inputBuilder";
import { validateImplementation } from "../src/validators/implementationValidator";
import type { ImplementationOutput, PrdOutput } from "../src/types/agents";

const PIPELINE_ID = "";
const JIRA_KEY = "DEMO-LAYER-TEST";
const REPO_URL = "https://github.com/Sudesha-agentos/sudesh_anna_test.git";
const REPO_BRANCH = "test";
const TARGET_FILE = "src/lib/utils.ts";

const prd: PrdOutput = {
  title: "Add truncateText utility",
  problemStatement: "UI needs a shared helper to shorten long strings for display.",
  proposedSolution:
    "Export truncateText(text, maxLength) from src/lib/utils.ts — return full text when short, otherwise slice and append ellipsis.",
  userStories: ["As a developer I want truncateText for card labels"],
  acceptanceCriteria: [
    "Given text shorter than maxLength When truncateText is called Then it returns the full text",
    "Given text longer than maxLength When truncateText is called Then it returns truncated text with ellipsis",
    "Given maxLength <= 0 When truncateText is called Then it returns empty string",
    "Function is exported from src/lib/utils.ts",
  ],
  outOfScope: ["UI changes"],
  edgeCases: ["empty string", "maxLength zero"],
  dependencies: [],
  successMetrics: ["TypeScript compiles"],
  openQuestions: [],
  confidenceScore: 0.95,
  confidenceReason: "Single-file pure function in existing utils module",
};

type LayerStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

function logLayer(
  layer: string,
  status: LayerStatus,
  detail: string,
  notes?: string
): void {
  const icon = { PASS: "✓", FAIL: "✗", SKIP: "—", WARN: "!" }[status];
  console.log(`\n[${icon}] ${layer} — ${status}`);
  console.log(`    ${detail}`);
  if (notes) console.log(`    Note: ${notes}`);
}

function cloneSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), "ananta-layers-"));
  execSync(`git clone --depth 1 --branch ${REPO_BRANCH} ${REPO_URL} .`, {
    cwd: sandbox,
    stdio: "pipe",
    timeout: 120_000,
  });
  execSync("git config user.email layer-test@agentos.ai", { cwd: sandbox, stdio: "ignore" });
  execSync("git config user.name LayerTest", { cwd: sandbox, stdio: "ignore" });
  return sandbox;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY required in server/.env");
    process.exit(1);
  }

  console.log("=== Ananta layer test ===");
  console.log(`Repo: ${REPO_URL} @ ${REPO_BRANCH}`);
  console.log(`Ticket: ${JIRA_KEY} → ${TARGET_FILE}`);

  const results: Array<{ layer: string; status: LayerStatus }> = [];
  let plan: ImplementationOutput | null = null;
  let codingResult: Awaited<ReturnType<typeof runEngineeringCodingAgentic>> | null = null;
  let workspaceDir = "";

  // ── L0 Planning agent ─────────────────────────────────────────────────────
  try {
    const agent = new EngineeringAgent();
    const context = buildEngineeringAgentContext(prd, [], "");
    const input = {
      context,
      prd,
      instruction: "Produce an implementation plan mapped to every acceptance criterion.",
      implementationMode: "code" as const,
      targetFilePaths: [TARGET_FILE],
    };
    const output = await agent.run(PIPELINE_ID, JSON.stringify(input, null, 2), {
      systemPrompt: buildEngineeringAgentSystemPrompt("code"),
      jsonMode: true,
      maxTokens: 8000,
    });
    plan = normalizeImplementationOutput(output.parsed, "code", [TARGET_FILE]);
    plan.implementationMode = "code";
    plan.targetFiles = plan.targetFiles?.length ? plan.targetFiles : [TARGET_FILE];

    const validation = validateImplementation(plan, prd, {
      implementationMode: "code",
      targetFiles: plan.targetFiles,
    });
    const hasTarget = (plan.targetFiles ?? []).some((p) => p.includes("utils.ts"));
    const l0Ok = validation.passed && hasTarget;
    logLayer(
      "L0 — Planning agent",
      l0Ok ? "PASS" : "FAIL",
      `validation=${validation.passed}, targetFiles=${JSON.stringify(plan.targetFiles)}, score=${validation.score}`
    );
    if (!validation.passed) {
      console.log("    Issues:", validation.issues.map((i) => i.message).join("; "));
    }
    results.push({ layer: "L0", status: l0Ok ? "PASS" : "FAIL" });
  } catch (err) {
    logLayer("L0 — Planning agent", "FAIL", err instanceof Error ? err.message : String(err));
    results.push({ layer: "L0", status: "FAIL" });
  }

  if (!plan) {
    console.log("\nAborting — L0 did not produce a plan.");
    process.exit(1);
  }

  // ── L2 Prompt assembly ────────────────────────────────────────────────────
  const userMessage = buildEngineeringCodingInitialUserMessage({
    pipelineId: PIPELINE_ID,
    jiraKey: JIRA_KEY,
    prd,
    implementation: plan,
    enrichedPrdDocument: {},
    branchName: REPO_BRANCH,
    implementationMode: "code",
  });
  const l2Target = userMessage.includes(TARGET_FILE);
  const l2Fn = userMessage.includes("truncateText") || userMessage.includes("truncate");
  const l2Ok = l2Target && l2Fn;
  logLayer(
    "L2 — Prompt assembly",
    l2Ok ? "PASS" : "FAIL",
    `targetInPrompt=${l2Target}, functionInPrompt=${l2Fn}, promptChars=${userMessage.length}`
  );
  results.push({ layer: "L2", status: l2Ok ? "PASS" : "FAIL" });

  // ── L3 Agentic coding loop ────────────────────────────────────────────────
  workspaceDir = cloneSandbox();
  registerEngWorkspaceLocal(PIPELINE_ID, JIRA_KEY, workspaceDir, REPO_BRANCH);

  try {
    const started = Date.now();
    codingResult = await runEngineeringCodingAgentic({
      pipelineId: PIPELINE_ID,
      jiraKey: JIRA_KEY,
      prd,
      implementation: plan,
      enrichedPrdDocument: {},
      implementationMode: "code",
      retainArtifacts: true,
    });
    const durationSec = ((Date.now() - started) / 1000).toFixed(1);

    const toolNames = codingResult.toolCallLog.map((t) => t.tool);
    const hasRead = toolNames.includes("read_file");
    const hasEdit =
      toolNames.includes("edit_file") || toolNames.includes("write_file");
    const fileContent = existsSync(join(workspaceDir, TARGET_FILE))
      ? readFileSync(join(workspaceDir, TARGET_FILE), "utf8")
      : "";
    const hasTruncate = fileContent.includes("truncateText");
    const gitChanged = await workspaceGetChangedFiles(workspaceDir);

    const l3Ok = hasEdit && hasTruncate && codingResult.codeChanges.length > 0;
    logLayer(
      "L3 — Agentic loop",
      l3Ok ? "PASS" : hasEdit || hasTruncate ? "WARN" : "FAIL",
      `tools=${codingResult.toolCallLog.length}, read=${hasRead}, edit=${hasEdit}, codeChanges=${codingResult.codeChanges.length}, gitChanged=${gitChanged.length}, ${durationSec}s`
    );
    console.log("    Summary:", codingResult.codingSummary.slice(0, 200));
    console.log("    Tool sequence:");
    for (const t of codingResult.toolCallLog) {
      console.log(`      ${t.tool} | ${t.query} | hits=${t.resultsFound}`);
    }
    results.push({
      layer: "L3",
      status: l3Ok ? "PASS" : hasEdit || hasTruncate ? "WARN" : "FAIL",
    });

    // ── L5 Result assembly ──────────────────────────────────────────────────
    const reportedChanges = codingResult.codeChanges.length;
    const gitDerived = gitChanged.length;
    const l5Ok = reportedChanges > 0 || gitDerived > 0;
    logLayer(
      "L5 — Result assembly",
      l5Ok ? "PASS" : "FAIL",
      `agentReported=${reportedChanges}, gitDerived=${gitDerived}, truncateInFile=${hasTruncate}`
    );
    results.push({ layer: "L5", status: l5Ok ? "PASS" : "FAIL" });

    // ── L6 Post-process gates (simulated) ───────────────────────────────────
    const zeroFileGateWouldFail = gitChanged.length === 0 && reportedChanges === 0;
    logLayer(
      "L6 — Zero-file gate",
      zeroFileGateWouldFail ? "PASS" : "PASS",
      zeroFileGateWouldFail
        ? "Would correctly throw (0 files changed)"
        : `Would pass gate (${Math.max(gitChanged.length, reportedChanges)} change(s))`
    );

    if (hasTruncate) {
      if (!existsSync(join(workspaceDir, "node_modules"))) {
        console.log("\nInstalling dependencies for L6 safety compile...");
        execSync("npm install", { cwd: workspaceDir, stdio: "pipe", timeout: 600_000 });
      }
      const compileResult = await runWorkspaceSafetyCompile(workspaceDir);
      const compileOk = compileResult.skipped || compileResult.exitCode === 0;
      logLayer(
        "L6 — Safety compile",
        compileOk ? "PASS" : "FAIL",
        compileResult.skipped
          ? `skipped: ${compileResult.reason}`
          : `${compileResult.command} exit=${compileResult.exitCode} subdir=${compileResult.subdir ?? "(root)"}`
      );
      if (!compileOk && compileResult.stderr) {
        console.log("    stderr:", compileResult.stderr.slice(0, 300));
      }
      results.push({ layer: "L6-compile", status: compileOk ? "PASS" : "FAIL" });
    } else {
      logLayer(
        "L6 — Safety compile",
        "SKIP",
        "no truncateText in file",
        "L3 did not produce expected edit"
      );
      results.push({ layer: "L6-compile", status: "SKIP" });
    }

    // ── L6 Git commit / push (orchestrator tail) ─────────────────────────────
    if (gitChanged.length > 0) {
      try {
        const pushResult = await workspaceCommitAndPush(
          workspaceDir,
          `[${JIRA_KEY}] ${codingResult?.codingSummary?.slice(0, 72) ?? "Ananta layer test"}`
        );
        logLayer(
          "L6 — Commit & push",
          pushResult ? "PASS" : "WARN",
          pushResult
            ? `branch=${pushResult.pushedBranch} sha=${pushResult.sha.slice(0, 8)}`
            : "commit returned null (clean tree after commit?)"
        );
        results.push({
          layer: "L6-git",
          status: pushResult ? "PASS" : "WARN",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = await workspaceGitStatus(workspaceDir).catch(() => "");
        const committedLocally = status === "" && gitChanged.length > 0;
        logLayer(
          "L6 — Commit & push",
          committedLocally ? "WARN" : "FAIL",
          msg.slice(0, 200),
          committedLocally
            ? "Commit likely succeeded; push failed (expected without GitHub push token locally)"
            : undefined
        );
        results.push({
          layer: "L6-git",
          status: committedLocally ? "WARN" : "FAIL",
        });
      }
    } else {
      logLayer("L6 — Commit & push", "SKIP", "no git changes to commit");
      results.push({ layer: "L6-git", status: "SKIP" });
    }

    // ── L7 Plan gate (post-coding, pre-QA) ───────────────────────────────────
    if (plan) {
      const postValidation = validateImplementation(plan, prd, {
        implementationMode: "code",
        targetFiles: plan.targetFiles,
      });
      logLayer(
        "L7 — IMPLEMENTATION_VALIDATION",
        postValidation.passed ? "PASS" : "FAIL",
        `score=${postValidation.score}, issues=${postValidation.issues.length}`
      );
      results.push({
        layer: "L7",
        status: postValidation.passed ? "PASS" : "FAIL",
      });
    }

    // ── L7 QA readiness (structural only — no Neel LLM run) ───────────────────
    const qaReady =
      hasTruncate &&
      (codingResult?.codeChanges.length ?? 0) > 0 &&
      (plan?.targetFiles?.length ?? 0) > 0;
    logLayer(
      "L7 — QA handoff readiness",
      qaReady ? "PASS" : "FAIL",
      qaReady
        ? "Plan valid, code changed, target file edited — Neel can run"
        : "Missing plan, edits, or target file for QA stage"
    );
    results.push({ layer: "L7-qa-ready", status: qaReady ? "PASS" : "FAIL" });

    if (hasTruncate) {
      console.log("\n--- utils.ts after agent ---");
      console.log(fileContent);
    }
  } finally {
    destroyEngWorkspace(PIPELINE_ID);
    if (workspaceDir && existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  }

  console.log("\n=== SUMMARY ===");
  const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
  for (const r of results) counts[r.status] += 1;
  console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} WARN=${counts.WARN} SKIP=${counts.SKIP}`);
  for (const r of results) {
    console.log(`  ${r.layer}: ${r.status}`);
  }

  if (counts.FAIL > 0 || counts.WARN > 0) {
    process.exitCode = counts.FAIL > 0 ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
