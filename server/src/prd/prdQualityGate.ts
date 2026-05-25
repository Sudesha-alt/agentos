import type { GeneratedPRD } from "./prdGenerator";

export interface PrdQualityResult {
  passed: boolean;
  issues: string[];
}

export function validateGeneratedPrd(prd: GeneratedPRD): PrdQualityResult {
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

  return { passed: issues.length === 0, issues };
}
