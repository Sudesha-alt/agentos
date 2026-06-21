import type { GeneratedPRD } from "./prdGenerator";

export interface PrdQualityResult {
  passed: boolean;
  issues: string[];
}

export function validateGeneratedPrd(
  prd: GeneratedPRD,
  options?: { relevantModuleCount?: number }
): PrdQualityResult {
  const issues: string[] = [];

  if (!prd.title?.trim()) issues.push("Missing title");
  if (!prd.problemStatement || prd.problemStatement.length < 20) {
    issues.push("Problem statement too short");
  }
  if (!prd.userStories?.length) issues.push("No user stories");
  for (const story of prd.userStories ?? []) {
    if (!story.acceptanceCriteria?.length) {
      issues.push(`Story ${story.id} has no acceptance criteria`);
    } else if (story.acceptanceCriteria.length < 2) {
      issues.push(`Story ${story.id} needs at least 2 acceptance criteria`);
    }
  }
  if (prd.prdConfidence < 0.5) {
    issues.push(`PRD confidence ${prd.prdConfidence} is critically low`);
  }
  const moduleCount = options?.relevantModuleCount ?? 0;
  if (moduleCount > 0) {
    if (!prd.existingCapabilities?.length) {
      issues.push("Missing existingCapabilities despite codebase modules found");
    }
    if (!prd.netNewWork?.length) {
      issues.push("Missing netNewWork despite codebase modules found");
    }
  }
  if (!prd.implementationDeltaSummary?.trim()) {
    issues.push("Missing implementationDeltaSummary tying PRD to codebase reality");
  }

  if (prd.implementationMode === "content") {
    if (!prd.deliverableFiles?.length) {
      issues.push("Content-mode PRD must include deliverableFiles with target doc paths");
    } else {
      for (const file of prd.deliverableFiles) {
        if (!file.path?.trim()) {
          issues.push("deliverableFiles entry missing path");
        } else if (!/\.\w+$/.test(file.path.trim())) {
          issues.push(`deliverableFiles path must include extension: ${file.path}`);
        }
      }
    }
    if ((prd.technicalRequirements?.endpoints ?? []).length > 0) {
      issues.push("Content-mode PRD should not declare API endpoints");
    }
  }

  return { passed: issues.length === 0, issues };
}
