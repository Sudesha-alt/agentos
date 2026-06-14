import type { PmPipelineContext } from "../agents/pm/pmPipelineContext";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import type {
  ImplementationOutput,
  PrdOutput,
} from "../types/agents";

export interface EngineeringCodingAgenticInput {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  enrichedPrdDocument: Record<string, unknown>;
  pmContext?: PmPipelineContext;
  branchName: string;
  compileFeedback?: string;
}

export function resolveCodingBranchName(): string {
  return (
    process.env.GITHUB_DEFAULT_BRANCH ||
    resolveRepoScope()?.defaultBranch ||
    "main"
  );
}

export function buildEngineeringCodingInitialUserMessage(
  input: EngineeringCodingAgenticInput
): string {
  const pmHandoff = input.pmContext?.enrichedPrdDocument?.pmHandoff as
    | Record<string, unknown>
    | undefined;

  const affectedFiles = Array.isArray(
    (input.enrichedPrdDocument.pmCodebaseImpact as { affectedFiles?: unknown })
      ?.affectedFiles
  )
    ? (
        input.enrichedPrdDocument.pmCodebaseImpact as {
          affectedFiles: Array<{ path: string; reason: string }>;
        }
      ).affectedFiles
    : [];

  const whereNotToTouch = Array.isArray(pmHandoff?.whereNotToTouch)
    ? (pmHandoff.whereNotToTouch as string[])
    : [];

  const implSteps = input.implementation.components
    .map((c) => `- ${c.name}: ${c.description} (~${c.estimatedDays}d)`)
    .join("\n");

  const design = input.pmContext?.enrichedPrdDocument?.pmSystemDesign as
    | Record<string, unknown>
    | undefined;
  const tasks = input.pmContext?.enrichedPrdDocument?.pmTaskBreakdown as
    | Array<{ id: string; title: string; files: string[] }>
    | undefined;

  return `
Jira: ${input.jiraKey}
Pipeline: ${input.pipelineId}
Branch: ${input.branchName}
PM context attached: ${input.pmContext ? "yes" : "no"}

PRD title: ${input.prd.title}
Problem: ${input.prd.problemStatement}
Solution: ${input.prd.proposedSolution}

Acceptance criteria:
${input.prd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Implementation plan summary:
${input.implementation.summary}

Technical approach:
${input.implementation.technicalApproach}

Plan components:
${implSteps}

Criteria mapping:
${input.implementation.criteriaMapping
  .map((m) => `- ${m.criterion} → ${m.implementation}`)
  .join("\n")}

API changes: ${input.implementation.apiChanges.join("; ") || "none"}
Database changes: ${input.implementation.databaseChanges.join("; ") || "none"}
Blockers: ${input.implementation.blockers.join("; ") || "none"}

${affectedFiles.length ? `Affected files (PM analysis):\n${affectedFiles.map((f) => `- ${f.path}: ${f.reason}`).join("\n")}` : ""}

${whereNotToTouch.length ? `Where NOT to touch:\n${whereNotToTouch.map((p) => `- ${p}`).join("\n")}` : ""}

${pmHandoff?.approachSummary ? `PM implementation approach:\n${String(pmHandoff.approachSummary)}` : ""}

${design ? `System design package:\n${JSON.stringify(design, null, 2)}` : ""}

${tasks?.length ? `Task breakdown:\n${tasks.map((t) => `- ${t.id}: ${t.title} (${t.files.join(", ")})`).join("\n")}` : ""}

${input.compileFeedback ? `SANDBOX COMPILE/TEST FEEDBACK — fix these errors before finishing:\n${input.compileFeedback}` : ""}

Begin PHASE 1: read and search the codebase on branch "${input.branchName}",
then PHASE 2: stage source file changes, then return the final JSON summary.
  `.trim();
}
