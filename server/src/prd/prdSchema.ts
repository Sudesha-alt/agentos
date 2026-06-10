import type { GeneratedPRD } from "./prdGenerator";

export const PRD_SCHEMA_VERSION = "1.0";

export function validateGeneratedPrdShape(prd: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!prd || typeof prd !== "object") {
    return { valid: false, errors: ["PRD must be an object"] };
  }
  const p = prd as Partial<GeneratedPRD>;

  if (!p.title?.trim()) errors.push("title is required");
  if (!p.problemStatement?.trim()) errors.push("problemStatement is required");
  if (!p.proposedSolution?.trim()) errors.push("proposedSolution is required");
  if (!Array.isArray(p.userStories) || p.userStories.length === 0) {
    errors.push("userStories must be a non-empty array");
  }
  if (!p.technicalRequirements || typeof p.technicalRequirements !== "object") {
    errors.push("technicalRequirements is required");
  }

  return { valid: errors.length === 0, errors };
}

export function toMarkdown(prd: GeneratedPRD): string {
  const lines = [
    `# ${prd.title}`,
    `Version: ${prd.version || PRD_SCHEMA_VERSION} | Jira: ${prd.jiraKey}`,
    "",
    "## Problem",
    prd.problemStatement,
    "",
    "## Solution",
    prd.proposedSolution,
    "",
    "## Success",
    prd.successDefinition,
    "",
    "## User stories",
    ...prd.userStories.map(
      (s) =>
        `- **${s.id}** (${s.priority}): ${s.story}\n  - AC: ${s.acceptanceCriteria.join("; ")}`
    ),
    "",
    "## Technical requirements",
    ...(prd.technicalRequirements.endpoints?.map(
      (e) => `- ${e.method} ${e.path}: ${e.description}`
    ) ?? []),
    "",
    "## Risks",
    ...prd.risks.map((r) => `- ${r.risk} (${r.probability}/${r.impact}): ${r.mitigation}`),
    "",
    "## Open questions",
    ...prd.openQuestions.map((q) => `- ${q.question} (owner: ${q.owner})`),
  ];
  return lines.join("\n");
}
