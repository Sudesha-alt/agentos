/**
 * Neel (QA) layer probe — same input as pipeline QA stage, tested per layer.
 * Usage: npx tsx scripts/neel-layer-probe.ts [JIRA-KEY]
 * Example: npx tsx scripts/neel-layer-probe.ts AG-61
 */
import "dotenv/config";
import { prisma } from "../src/db/client";
import { saveGitCredentials } from "../src/git-integration/gitCredentialsStore";
import { gitClient } from "../src/integrations/gitProvider";
import { resolveImplementationBranchForQa } from "../src/qa/resolveImplementationBranch";
import { setQaImplementationBranch } from "../src/qa/qaArtifactStore";
import { resolveEngineeringBranchName } from "../src/engineering/engineeringWorkspace";
import { buildQaInitialUserMessage, resolveQaBranchName } from "../src/qaAgent/inputBuilder";
import { executeQaToolCall } from "../src/tools/qaToolExecutor";
import { validateQa } from "../src/validators/qaValidator";
import type { ImplementationOutput, PrdOutput, QaOutput } from "../src/types/agents";
import { loadTicketPipelineInputs } from "./loadTicketPipelineInputs";
import { TEST_REPO_BRANCH, TEST_REPO_NAME, TEST_REPO_OWNER } from "./testRepoConfig";

const JIRA_KEY = process.argv[2]?.trim() || "AG-62";

let PIPELINE_ID = "";
let DELIVERABLE = "docs/curriculum/year-1-52-week-curriculum.md";
let IMPL_BRANCH = resolveEngineeringBranchName(JIRA_KEY);
let prd: PrdOutput;
let implementation: ImplementationOutput;
let productionQaOutput: QaOutput | undefined;
let productionQaValidation: Record<string, unknown> | undefined;
let allDeliverables: string[] = [];

type LayerStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

type LayerResult = {
  layer: string;
  status: LayerStatus;
  expected: string;
  actual: string;
  notes?: string;
};

const results: LayerResult[] = [];

function record(
  layer: string,
  status: LayerStatus,
  expected: string,
  actual: string,
  notes?: string
): void {
  results.push({ layer, status, expected, actual, notes });
  const icon = { PASS: "✓", FAIL: "✗", WARN: "!", SKIP: "—" }[status];
  console.log(`\n[${icon}] ${layer} — ${status}`);
  console.log(`  Expected: ${expected}`);
  console.log(`  Actual:   ${actual}`);
  if (notes) console.log(`  Notes:    ${notes}`);
}

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
    LIMIT 5
  `)) as Array<{
    workspace: string;
    repoSlug: string;
    token: string;
    defaultBranch: string;
  }>;

  const row =
    rows.find((r) => r.workspace === TEST_REPO_OWNER && r.repoSlug === TEST_REPO_NAME) ??
    rows[0];

  if (!row?.token) {
    throw new Error("No PAT — set GITHUB_TOKEN or connect Git Integration.");
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

async function probeQaTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ content: string; isError: boolean; resultsFound?: number }> {
  const result = await executeQaToolCall(
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

async function branchHasFile(branch: string, path: string): Promise<boolean> {
  try {
    await gitClient.getFileContent(path, branch);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const loaded = await loadTicketPipelineInputs(JIRA_KEY);
  if (!loaded) {
    console.error(`Could not load pipeline inputs for ${JIRA_KEY}`);
    process.exit(1);
  }

  PIPELINE_ID = loaded.pipelineId;
  prd = loaded.prd;
  implementation = loaded.implementation;
  IMPL_BRANCH = loaded.implementationBranch;
  allDeliverables = loaded.deliverablePaths;
  DELIVERABLE = allDeliverables[0] ?? implementation.targetFiles?.[0] ?? DELIVERABLE;
  productionQaOutput = loaded.qaOutput;
  productionQaValidation = loaded.qaValidation;

  console.log("=== Neel (QA) layer probe ===");
  console.log(`Ticket: ${JIRA_KEY}`);
  console.log(`Pipeline: ${PIPELINE_ID}`);
  console.log(`Primary deliverable: ${DELIVERABLE}`);
  console.log(`All deliverables: ${allDeliverables.join(", ")}`);
  console.log(`Implementation branch: ${IMPL_BRANCH}`);
  console.log(`PRD criteria: ${prd.acceptanceCriteria.length}`);
  console.log(`Repo: ${TEST_REPO_OWNER}/${TEST_REPO_NAME}`);

  await loadPatCredentials();

  // ── L1 Branch resolution ─────────────────────────────────────────────────
  const qaBranchExplicit = resolveQaBranchName(IMPL_BRANCH, JIRA_KEY);
  record(
    "L1 — resolveQaBranchName (explicit)",
    qaBranchExplicit === IMPL_BRANCH ? "PASS" : "FAIL",
    IMPL_BRANCH,
    qaBranchExplicit
  );

  const qaBranchDefaultOnly = resolveQaBranchName(undefined, JIRA_KEY);
  record(
    "L1 — resolveQaBranchName (from jira key)",
    qaBranchDefaultOnly === IMPL_BRANCH ? "PASS" : "FAIL",
    IMPL_BRANCH,
    qaBranchDefaultOnly
  );

  const auditBranch = await resolveImplementationBranchForQa(PIPELINE_ID, JIRA_KEY);
  record(
    "L1 — resolveImplementationBranchForQa (from audit)",
    auditBranch === IMPL_BRANCH ? "PASS" : "WARN",
    IMPL_BRANCH,
    auditBranch,
    auditBranch !== IMPL_BRANCH ? "Audit log branch differs from push metadata" : undefined
  );

  // ── L2 Prompt assembly ───────────────────────────────────────────────────
  setQaImplementationBranch(PIPELINE_ID, IMPL_BRANCH);
  const userMessage = buildQaInitialUserMessage({
    pipelineId: PIPELINE_ID,
    jiraKey: JIRA_KEY,
    prd,
    implementation,
    retrievedContext: [],
    branchName: IMPL_BRANCH,
  });
  const hasBranch = userMessage.includes(IMPL_BRANCH);
  const hasDeliverable = userMessage.includes(DELIVERABLE);
  const hasCriteria = userMessage.includes("Acceptance criteria");
  record(
    "L2 — QA prompt assembly",
    hasBranch && hasDeliverable && hasCriteria ? "PASS" : "FAIL",
    `Prompt mentions branch, deliverable, criteria`,
    `branch=${hasBranch}, deliverable=${hasDeliverable}, criteria=${hasCriteria}, chars=${userMessage.length}`
  );

  // ── L3 GitHub read — branch comparison (root cause probe) ────────────────
  const onImplBranch = await branchHasFile(IMPL_BRANCH, DELIVERABLE);
  const onTestBranch = await branchHasFile(TEST_REPO_BRANCH, DELIVERABLE);
  const onMainBranch = await branchHasFile("main", DELIVERABLE);

  record(
    "L3 — file on implementation branch",
    onImplBranch ? "PASS" : "FAIL",
    `${DELIVERABLE} readable on ${IMPL_BRANCH}`,
    onImplBranch ? "file found" : "404 / not found"
  );
  record(
    "L3 — file on clone source branch (test)",
    onTestBranch ? "WARN" : "PASS",
    onTestBranch ? "also on test" : "not on test (expected — Ananta pushes to agentos/*)",
    onTestBranch ? "found on test" : "not found on test"
  );
  record(
    "L3 — file on main",
    onMainBranch ? "WARN" : "PASS",
    "deliverable not only on main",
    onMainBranch ? "found on main" : "not on main"
  );

  // ── L4 Tool layer — read_implementation_files ──────────────────────────
  const readPaths = allDeliverables.length ? allDeliverables : [DELIVERABLE];
  const readCorrect = await probeQaTool("read_implementation_files", {
    file_paths: readPaths,
    branch_name: IMPL_BRANCH,
  });
  const readCorrectOk =
    !readCorrect.isError &&
    readCorrect.content.includes('"content"') &&
    !readCorrect.content.includes('"error"');
  record(
    "L4 — read_implementation_files (correct branch)",
    readCorrectOk ? "PASS" : "FAIL",
    "Returns curriculum file content (not embedded 404 error)",
    readCorrect.isError
      ? readCorrect.content.slice(0, 200)
      : readCorrect.content.slice(0, 220).replace(/\n/g, " ")
  );

  const readWrongBranch = await probeQaTool("read_implementation_files", {
    file_paths: [DELIVERABLE],
    branch_name: TEST_REPO_BRANCH,
  });
  const readWrongHasError =
    readWrongBranch.content.includes("error") ||
    readWrongBranch.content.includes("404") ||
    readWrongBranch.content.includes("Not Found");
  record(
    "L4 — read_implementation_files (wrong branch=test)",
    !onTestBranch && readWrongHasError ? "PASS" : onTestBranch ? "WARN" : "FAIL",
    "404 or error when file not on test branch",
    readWrongBranch.content.slice(0, 200)
  );

  // LLM often sends branch_name: main — artifact store should override
  setQaImplementationBranch(PIPELINE_ID, IMPL_BRANCH);
  const readLlmWrong = await probeQaTool("read_implementation_files", {
    file_paths: [DELIVERABLE],
    branch_name: "main",
  });
  const readLlmUsesImpl =
    !readLlmWrong.isError && !readLlmWrong.content.includes("404");
  record(
    "L4 — branch_name=main overridden by artifact store",
    onImplBranch && readLlmUsesImpl ? "PASS" : !onImplBranch ? "SKIP" : "FAIL",
    `Still reads from ${IMPL_BRANCH} when LLM asks for main`,
    readLlmWrong.content.slice(0, 200),
    onImplBranch
      ? undefined
      : "Implementation branch has no file — fix Ananta push first"
  );

  // ── L4 search_implementation ─────────────────────────────────────────────
  const search = await probeQaTool("search_implementation", {
    query: "year 1 52 week curriculum",
    branch_name: IMPL_BRANCH,
  });
  record(
    "L4 — search_implementation",
    (search.resultsFound ?? 0) >= 0 ? "PASS" : "FAIL",
    "Semantic search returns (may be 0 if index stale)",
    `hits=${search.resultsFound ?? 0}`,
    (search.resultsFound ?? 0) === 0
      ? "Index may not include agentos branch — read_implementation_files is authoritative"
      : undefined
  );

  // ── L5 Validator (golden vs broken output) ───────────────────────────────
  const goldenQa: QaOutput = {
    testSummary:
      "Read curriculum markdown on implementation branch and verified all acceptance criteria via checklist test cases.",
    testCases: prd.acceptanceCriteria.map((criterion, i) => ({
      id: `TC-${String(i + 1).padStart(3, "0")}`,
      title: `Verify: ${criterion.slice(0, 40)}`,
      type: "integration" as const,
      linkedCriterion: criterion,
      preconditions: [`Branch ${IMPL_BRANCH} contains ${DELIVERABLE}`],
      steps: ["read_implementation_files", "Review document sections"],
      expectedResult: criterion,
      priority: "high" as const,
    })),
    coverageReport: {
      totalCriteria: prd.acceptanceCriteria.length,
      coveredCriteria: prd.acceptanceCriteria.length,
      coveragePercent: 100,
      uncoveredCriteria: [],
    },
    riskAreas: [],
    automationRecommendations: [],
    confidenceScore: 0.92,
    confidenceReason: "All criteria linked to checklist cases after reading deliverable.",
  };

  const goldenValidation = validateQa(goldenQa, prd);
  record(
    "L5 — validateQa (golden output)",
    goldenValidation.passed ? "PASS" : "FAIL",
    "Validator passes well-formed QA output",
    goldenValidation.passed
      ? `score=${goldenValidation.score}`
      : goldenValidation.issues.map((i) => i.message).join("; ")
  );

  const brokenQa: QaOutput = {
    ...goldenQa,
    testCases: goldenQa.testCases.slice(0, 1),
    coverageReport: {
      totalCriteria: prd.acceptanceCriteria.length,
      coveredCriteria: prd.acceptanceCriteria.length,
      coveragePercent: 100,
      uncoveredCriteria: [],
    },
  };
  const brokenValidation = validateQa(brokenQa, prd);
  record(
    "L5 — validateQa (under-covered — should fail)",
    !brokenValidation.passed ? "PASS" : "FAIL",
    "Validator rejects partial coverage",
    brokenValidation.issues.map((i) => i.code).join(", ") || "unexpectedly passed"
  );

  // ── L7 Production QA output vs validator (stored pipeline run) ─────────
  if (productionQaOutput) {
    const layerValidation = validateQa(productionQaOutput, prd);
    record(
      "L7 — production Neel JSON vs validateQa",
      layerValidation.passed ? "PASS" : "FAIL",
      "Stored QA_AGENT output passes validator",
      layerValidation.passed
        ? `score=${layerValidation.score}`
        : layerValidation.issues.map((i) => `${i.code}: ${i.message.slice(0, 80)}`).join(" | ")
    );
    record(
      "L7 — production QA_VALIDATION stage",
      productionQaValidation?.passed === true ? "PASS" : "FAIL",
      "Pipeline QA_VALIDATION passed",
      productionQaValidation?.passed === true
        ? "passed"
        : JSON.stringify((productionQaValidation as { issues?: unknown[] })?.issues)?.slice(0, 250) ?? "failed"
    );
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const linked = productionQaOutput.testCases.map((tc) => tc.linkedCriterion);
    const exactMatches = prd.acceptanceCriteria.filter((c) =>
      linked.some((l) => norm(l) === norm(c))
    ).length;
    record(
      "L7 — linkedCriterion exact match",
      exactMatches === prd.acceptanceCriteria.length ? "PASS" : "FAIL",
      `${prd.acceptanceCriteria.length} exact matches required`,
      `${exactMatches}/${prd.acceptanceCriteria.length} — PRD: "${prd.acceptanceCriteria[0]?.slice(0, 45)}..." vs Neel: "${linked[0]?.slice(0, 50)}..."`,
      exactMatches === 0
        ? "Neel uses numbered prefixes (1. 2. …); validator requires exact PRD strings"
        : undefined
    );
  }

  // ── L6 Full QA agent (optional re-run) ───────────────────────────────────
  record("L6 — runQaAgentic (re-run)", "SKIP", "Full LLM re-run", "Using stored production QA output in L7");

  // ── Summary + diagnosis ──────────────────────────────────────────────────
  console.log("\n=== LAYER vs FULL AGENT — WHERE IT BREAKS ===");
  const l3Fail = results.find((r) => r.layer.includes("implementation branch") && r.status === "FAIL");
  const l4ReadFail = results.find((r) => r.layer.includes("read_implementation_files (correct") && r.status === "FAIL");
  const l6ValFail = results.find((r) => r.layer.includes("validateQa") && r.status === "FAIL");

  const l7ValFail = results.find((r) => r.layer.includes("production Neel JSON") && r.status === "FAIL");
  const l7LinkFail = results.find((r) => r.layer.includes("linkedCriterion exact") && r.status === "FAIL");

  if (l3Fail) {
    console.log("→ ROOT: Deliverable not on GitHub implementation branch. Neel cannot read what Ananta pushed.");
  } else if (l4ReadFail) {
    console.log("→ ROOT: GitHub read tool fails even though file exists — check PAT scope / repo config.");
  } else if (l7LinkFail || l7ValFail) {
    console.log("→ ROOT: Neel read files and produced a report, but QA_VALIDATION fails — linkedCriterion text must exactly match PRD acceptanceCriteria (no numbered prefixes).");
  } else if (l6ValFail) {
    console.log("→ ROOT: Neel runs but JSON fails validateQa — linkedCriterion or coverage mismatch.");
  } else if (results.every((r) => r.status === "PASS" || r.status === "SKIP" || r.status === "WARN")) {
    console.log("→ All probed layers OK. If pipeline QA still fails, check production audit branch resolution or QA_VALIDATION gate.");
  }

  console.log("\n=== SUMMARY ===");
  const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
  for (const r of results) counts[r.status] += 1;
  console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} WARN=${counts.WARN} SKIP=${counts.SKIP}`);
  for (const r of results) {
    console.log(`  ${r.layer}: ${r.status}`);
  }

  if (counts.FAIL > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
