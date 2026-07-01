import type { PmPipelineContext } from "../agents/pm/pmPipelineContext";
import { resolveContentDeliverablePaths } from "../engineering/contentDeliverables";
import {
  collectVerifiedRepoPaths,
  formatVerifiedPathsBlock,
  filterToVerifiedPaths,
} from "../agents/pm/verifiedRepoPaths";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import type { GeneratedPRD } from "../prd/prdGenerator";
import type {
  ImplementationMode,
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
  implementationMode?: ImplementationMode;
  deliverableFiles?: Array<{ path: string; format: string; purpose: string }>;
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

  const generatedPrd =
    input.pmContext?.generatedPrd ??
    (input.enrichedPrdDocument.generatedPrd as GeneratedPRD | undefined);

  const mode = input.implementationMode ?? generatedPrd?.implementationMode ?? "code";
  const deliverableFiles =
    input.deliverableFiles ??
    generatedPrd?.deliverableFiles ??
    input.implementation.targetFiles?.map((path) => ({
      path,
      format: path.endsWith(".md") ? "markdown" : "document",
      purpose: "Implementation target file",
    })) ??
    [];

  const taskFilePaths = filterToVerifiedPaths(
    [...new Set((tasks ?? []).flatMap((t) => t.files ?? []))],
    collectVerifiedRepoPaths(input.pmContext ?? null)
  );
  const verifiedPaths = collectVerifiedRepoPaths(input.pmContext ?? null);
  const requiredPaths =
    mode === "content"
      ? resolveContentDeliverablePaths({
          deliverableFiles,
          targetFilePaths: [
            ...deliverableFiles.map((f) => f.path),
            ...taskFilePaths,
          ],
          implementationTargetFiles: input.implementation.targetFiles,
        })
      : [
          ...new Set([
            ...deliverableFiles.map((f) => f.path),
            ...taskFilePaths,
            ...(input.implementation.targetFiles ?? []),
          ]),
        ].filter(Boolean);

  const requiredFilesBlock =
    mode === "content" && requiredPaths.length
      ? `REQUIRED OUTPUT FILES (you MUST write_file each before finishing):
${requiredPaths.map((p) => `- ${p}`).join("\n")}
${deliverableFiles.length ? `\nDeliverable details:\n${deliverableFiles.map((f) => `- ${f.path} (${f.format}): ${f.purpose}`).join("\n")}` : ""}
`
      : mode === "content"
        ? `REQUIRED OUTPUT FILES: PRD did not list deliverableFiles — infer doc paths from netNewWork and task breakdown, then write_file each.`
        : "";

  return `
Jira: ${input.jiraKey}
Pipeline: ${input.pipelineId}
Working branch: ${input.branchName}
Implementation mode: ${mode}
PM context attached: ${input.pmContext ? "yes" : "no"}

${formatVerifiedPathsBlock(verifiedPaths)}

${requiredFilesBlock}

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

${tasks?.length ? `Task breakdown (file paths omitted unless verified in codebase analysis):\n${tasks.map((t) => `- ${t.id}: ${t.title}${t.files?.length ? ` (${t.files.join(", ")})` : ""}${t.description ? ` — ${t.description}` : ""}`).join("\n")}` : ""}

${generatedPrd ? `Full PM-generated PRD (authoritative — implement every feature, user story, and requirement described here):\n${JSON.stringify(generatedPrd, null, 2)}` : ""}

${generatedPrd?.implementationDeltaSummary ? `CODEBASE DELTA (build only net-new work):\nSummary: ${generatedPrd.implementationDeltaSummary}\nAlready exists:\n${(generatedPrd.existingCapabilities ?? []).map((c) => `- ${c}`).join("\n")}\nNet-new work:\n${(generatedPrd.netNewWork ?? []).map((c) => `- ${c}`).join("\n")}\nReuse from codebase:\n${(generatedPrd.reuseFromCodebase ?? []).map((c) => `- ${c}`).join("\n")}` : ""}

${input.compileFeedback ? `SANDBOX COMPILE/TEST FEEDBACK — fix these errors before finishing:\n${input.compileFeedback}` : ""}

Begin PHASE 1: explore the codebase (list_dir, grep, search_codebase, read_file),
PHASE 2: implement using edit_file / write_file,
PHASE 3: verify with run_command (type-checker), fix errors,
PHASE 4: return the final JSON summary.
  `.trim();
}
