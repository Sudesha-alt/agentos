import { prisma } from "../../db/client";
import { resolveRepoScope } from "../../codebaseIntelligence/repoScope";
import { githubClient } from "../../integrations/githubClient";
import { getActivePipelineJiraCredentials } from "../../pipeline/jira/credentialsStore";
import { ValidationError, NotFoundError } from "../../utils/errors";
import { pmAnalysisStore } from "./store";
import type {
  AcceptanceCriterion,
  AffectedFileEntry,
  EdgeCase,
  EffortBreakdown,
  ImplementationStep,
  PmAnalysisRecord,
} from "./types";

export interface CodeSnapshot {
  path: string;
  content: string;
  size?: number;
  error?: string;
}

export interface TechAgentHandoff {
  jiraId: string;
  jiraUrl: string | null;
  type: string;
  subtype: string;
  severity: string;
  recommendation: string;
  realUserProblem: string;
  cleanSummary: string;
  suggestedFirstFile: string;
  suggestedFirstFileReason: string;
  affectedFiles: AffectedFileEntry[];
  whereNotToTouch: string[];
  recentCommitHistory: string;
  approachSummary: string;
  implementationSteps: ImplementationStep[];
  alternativeApproach: string;
  userStory: string;
  happyPath: AcceptanceCriterion[];
  edgeCases: EdgeCase[];
  explicitlyOutOfScope: string[];
  regressionRisks: string[];
  definitionOfDone: string[];
  testingGuidance: string;
  tshirt: string;
  storyPoints: string;
  effortBreakdown: EffortBreakdown;
  openQuestions: string[];
  branchName: string;
  codeSnapshots: CodeSnapshot[];
}

function jiraBrowseUrl(jiraKey: string): string | null {
  const base = getActivePipelineJiraCredentials().baseUrl?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/browse/${jiraKey}`;
}

function parseSuggestedFirstFile(raw: string): { file: string; reason: string } {
  const sep = raw.indexOf(" — ");
  if (sep > 0) {
    return { file: raw.slice(0, sep).trim(), reason: raw.slice(sep + 3).trim() };
  }
  const dash = raw.indexOf(" - ");
  if (dash > 0) {
    return { file: raw.slice(0, dash).trim(), reason: raw.slice(dash + 3).trim() };
  }
  return { file: raw.trim(), reason: "" };
}

async function fetchRecentCommitHistory(
  filePaths: string[],
  branchName: string
): Promise<string> {
  if (filePaths.length === 0) return "No affected files identified — commit history unavailable.";

  try {
    const scope = resolveRepoScope();
    if (!scope) return "Repository not configured — commit history unavailable.";

    const commits = await prisma.commitHistory.findMany({
      where: {
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
        branchName,
      },
      orderBy: { authoredAt: "desc" },
      take: 12,
    });

    const relevant = commits.filter((c) => {
      const modified = [
        ...(Array.isArray(c.filesModified) ? c.filesModified : []),
        ...(Array.isArray(c.filesAdded) ? c.filesAdded : []),
      ] as string[];
      return modified.some((f) =>
        filePaths.some((p) => f.includes(p) || p.includes(f))
      );
    });

    const list = (relevant.length ? relevant : commits).slice(0, 6);
    if (list.length === 0) return "No recent commits indexed for this repository.";

    return list
      .map(
        (c) =>
          `${c.sha.slice(0, 7)} | ${c.author} | ${c.authoredAt.toISOString().slice(0, 10)} | ${c.message.slice(0, 120)}`
      )
      .join("\n");
  } catch {
    return "Commit history unavailable.";
  }
}

function requireStages(record: PmAnalysisRecord): void {
  const missing: string[] = [];
  if (!record.enrichment) missing.push("enrichment");
  if (!record.classification) missing.push("classification");
  if (!record.codebaseImpact) missing.push("codebaseImpact");
  if (!record.effortEstimate) missing.push("effortEstimate");
  if (!record.implementation) missing.push("implementation");
  if (!record.prioritization) missing.push("prioritization");
  if (!record.acceptanceCriteria) missing.push("acceptanceCriteria");

  if (missing.length > 0) {
    throw new ValidationError(
      `PM analysis incomplete — missing stages: ${missing.join(", ")}`,
      { jiraKey: record.jiraKey, status: record.status, missingStages: missing }
    );
  }
}

export function formatAffectedFiles(files: AffectedFileEntry[]): string {
  if (!files.length) return "None identified.";
  return files
    .map((f) => {
      const lines = [
        `- ${f.path}`,
        `  Role: ${f.role}`,
        `  Risk: ${f.riskLevel}`,
        `  Why: ${f.reason}`,
      ];
      return lines.join("\n");
    })
    .join("\n");
}

export function formatList(items: string[], emptyLabel = "None."): string {
  if (!items.length) return emptyLabel;
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatSteps(steps: ImplementationStep[]): string {
  if (!steps.length) return "No implementation steps recorded.";
  return steps
    .map((s) => {
      const lines = [
        `${s.step}. ${s.action}`,
        `   Why: ${s.why}`,
      ];
      if (s.watchOut) lines.push(`   Watch out: ${s.watchOut}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function formatScenarios(
  criteria: AcceptanceCriterion[],
  label: string
): string {
  if (!criteria.length) return `No ${label} scenarios recorded.`;
  return criteria
    .map((c, i) => {
      if ("scenario" in c && (c as EdgeCase).scenario) {
        const e = c as EdgeCase;
        return [
          `${i + 1}. ${e.scenario}`,
          `   GIVEN ${e.given}`,
          `   WHEN ${e.when}`,
          `   THEN ${e.then}`,
        ].join("\n");
      }
      return [
        `${i + 1}.`,
        `   GIVEN ${c.given}`,
        `   WHEN ${c.when}`,
        `   THEN ${c.then}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function formatChecklist(items: string[]): string {
  if (!items.length) return "None specified.";
  return items.map((item) => `[ ] ${item}`).join("\n");
}

export function formatCommitHistory(history: string): string {
  if (!history.trim()) return "No recent commits available.";
  return history;
}

export function formatEffortBreakdown(breakdown: EffortBreakdown): string {
  return [
    `- Investigation: ${breakdown.investigation}`,
    `- Implementation: ${breakdown.implementation}`,
    `- Testing: ${breakdown.testing}`,
    `- Review: ${breakdown.review}`,
  ].join("\n");
}

const PR_REQUIREMENTS_TEMPLATE = `Branch naming: \`{{jiraId}}-short-description\`
Link PR to Jira: include \`{{jiraId}}\` in PR title or description
Target branch: \`{{branchName}}\`
Required before review:
- All acceptance criteria covered by tests or manual verification notes
- No unrelated refactors or drive-by changes
- Update any relevant inline docs if behavior changed
- Self-review diff against "where not to touch" list`;

const WHAT_NOT_TO_DO = `- Do not refactor unrelated modules or rename files outside the affected set
- Do not change API contracts not listed in this handoff without PM sign-off
- Do not skip tests for billing, auth, or data-migration paths
- Do not merge with failing CI or unresolved open questions marked as blockers
- Do not expand scope beyond acceptance criteria without a new ticket`;

const AFTER_MERGE = `- Move Jira ticket to Done and attach PR link
- Notify QA if manual verification is required
- Monitor error rates and key metrics for 24h if production-facing
- Close or update any open questions documented in this handoff
- Optional: run PM retrospective to improve future handoff accuracy`;

export function buildTechAgentHandoffFromRecord(
  record: PmAnalysisRecord
): TechAgentHandoff {
  requireStages(record);

  const enrichment = record.enrichment!;
  const classification = record.classification!;
  const impact = record.codebaseImpact!;
  const effort = record.effortEstimate!;
  const impl = record.implementation!;
  const prio = record.prioritization!;
  const ac = record.acceptanceCriteria!;

  const scope = resolveRepoScope();
  const branchName = scope?.defaultBranch ?? "main";

  const { file: suggestedFirstFile, reason: parsedReason } = parseSuggestedFirstFile(
    impact.suggestedFirstFile
  );
  const primaryFile = impact.affectedFiles.find(
    (f) => f.role.toLowerCase() === "primary"
  );
  const suggestedFirstFileReason =
    parsedReason ||
    primaryFile?.reason ||
    impact.recentChangeConnection ||
    "Start here based on codebase impact analysis.";

  const filePaths = impact.affectedFiles.map((f) => f.path);

  return {
    jiraId: record.jiraKey,
    jiraUrl: jiraBrowseUrl(record.jiraKey),
    type: classification.type,
    subtype: classification.subtype,
    severity: classification.severity,
    recommendation: prio.recommendation,
    realUserProblem: enrichment.realUserProblem,
    cleanSummary: enrichment.cleanSummary,
    suggestedFirstFile,
    suggestedFirstFileReason,
    affectedFiles: impact.affectedFiles,
    whereNotToTouch: impl.whereNotToTouch,
    recentCommitHistory: "",
    approachSummary: impl.approachSummary,
    implementationSteps: impl.implementationSteps,
    alternativeApproach: impl.alternativeApproach,
    userStory: ac.userStory,
    happyPath: ac.happyPath,
    edgeCases: ac.edgeCases,
    explicitlyOutOfScope: ac.explicitlyOutOfScope,
    regressionRisks: ac.regressionRisks,
    definitionOfDone: ac.definitionOfDone,
    testingGuidance: impl.testingGuidance,
    tshirt: effort.tshirt,
    storyPoints: effort.storyPoints,
    effortBreakdown: effort.breakdown,
    openQuestions: impl.openQuestionsForEngineer,
    branchName,
    codeSnapshots: [],
  };
}

export async function buildTechAgentHandoff(ticketId: string): Promise<TechAgentHandoff> {
  const jiraKey = ticketId.trim().toUpperCase();
  const record = pmAnalysisStore.get(jiraKey);
  if (!record) {
    throw new NotFoundError(`PM analysis not found for ${jiraKey}`);
  }

  const handoff = buildTechAgentHandoffFromRecord(record);
  handoff.recentCommitHistory = await fetchRecentCommitHistory(
    handoff.affectedFiles.map((f) => f.path),
    handoff.branchName
  );
  return handoff;
}

export async function attachCodeSnapshots(
  handoff: TechAgentHandoff
): Promise<TechAgentHandoff> {
  const topFiles = handoff.affectedFiles
    .filter((f) => f.role.toLowerCase() === "primary")
    .slice(0, 3);

  if (topFiles.length === 0) {
    return { ...handoff, codeSnapshots: [] };
  }

  const snapshots = await Promise.all(
    topFiles.map(async (f): Promise<CodeSnapshot> => {
      try {
        const file = await githubClient.getFileContent(f.path, handoff.branchName);
        const maxChars = 12000;
        const content =
          file.content.length > maxChars
            ? `${file.content.slice(0, maxChars)}\n\n/* … truncated (${file.content.length} chars total) */`
            : file.content;
        return { path: file.path, content, size: file.size };
      } catch (err) {
        return {
          path: f.path,
          content: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return { ...handoff, codeSnapshots: snapshots };
}

export function renderHandoffPrompt(handoff: TechAgentHandoff): string {
  const prRequirements = PR_REQUIREMENTS_TEMPLATE.replace(/\{\{jiraId\}\}/g, handoff.jiraId).replace(
    /\{\{branchName\}\}/g,
    handoff.branchName
  );

  const snapshotSection =
    handoff.codeSnapshots.length === 0
      ? "No primary file snapshots available (Git not connected or files not found)."
      : handoff.codeSnapshots
          .map((s) => {
            if (s.error) {
              return `### ${s.path}\n\n_Failed to load: ${s.error}_`;
            }
            return `### ${s.path}\n\n\`\`\`\n${s.content}\n\`\`\``;
          })
          .join("\n\n");

  return `# Tech Agent Handoff — ${handoff.jiraId}

## 1. TICKET CONTEXT

- **Jira ID:** ${handoff.jiraId}
- **Jira URL:** ${handoff.jiraUrl ?? "Not configured"}
- **Type:** ${handoff.type} / ${handoff.subtype}
- **Severity:** ${handoff.severity}
- **Recommendation:** ${handoff.recommendation}

**Real user problem:**
${handoff.realUserProblem}

**Clean summary:**
${handoff.cleanSummary}

---

## 2. WHERE TO WORK

**Suggested first file:** \`${handoff.suggestedFirstFile}\`

**Why start here:**
${handoff.suggestedFirstFileReason}

**Affected files:**
${formatAffectedFiles(handoff.affectedFiles)}

**Where NOT to touch:**
${formatList(handoff.whereNotToTouch)}

---

## 3. RECENT CODE CONTEXT

${formatCommitHistory(handoff.recentCommitHistory)}

---

## 4. HOW TO IMPLEMENT IT

**Approach summary:**
${handoff.approachSummary}

**Implementation steps:**
${formatSteps(handoff.implementationSteps)}

**Alternative approach:**
${handoff.alternativeApproach || "None documented."}

---

## 5. WHAT DONE LOOKS LIKE

**User story:**
${handoff.userStory}

**Happy path:**
${formatScenarios(handoff.happyPath, "happy path")}

**Edge cases:**
${formatScenarios(handoff.edgeCases, "edge case")}

**Explicitly out of scope:**
${formatList(handoff.explicitlyOutOfScope)}

**Regression risks:**
${formatList(handoff.regressionRisks)}

**Definition of done:**
${formatChecklist(handoff.definitionOfDone)}

---

## 6. TESTING GUIDANCE

${handoff.testingGuidance || "No specific testing guidance provided."}

---

## 7. EFFORT CONTEXT

- **T-shirt size:** ${handoff.tshirt}
- **Story points:** ${handoff.storyPoints}

**Hour breakdown:**
${formatEffortBreakdown(handoff.effortBreakdown)}

---

## 8. OPEN QUESTIONS

${formatList(handoff.openQuestions, "No open questions — proceed unless you discover blockers.")}

---

## 9. PR REQUIREMENTS

${prRequirements}

---

## 10. WHAT NOT TO DO

${WHAT_NOT_TO_DO}

---

## 11. AFTER MERGE

${AFTER_MERGE}

---

## 12. CURRENT CODE — PRIMARY FILES

${snapshotSection}
`.trim();
}

export async function getTechAgentHandoff(ticketId: string): Promise<{
  handoff: TechAgentHandoff;
  prompt: string;
  codeSnapshots: CodeSnapshot[];
}> {
  const base = await buildTechAgentHandoff(ticketId);
  const handoff = await attachCodeSnapshots(base);
  const prompt = renderHandoffPrompt(handoff);
  return {
    handoff,
    prompt,
    codeSnapshots: handoff.codeSnapshots,
  };
}
