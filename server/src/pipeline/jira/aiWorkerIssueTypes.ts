/** Issue types the AI Worker column may pick up — Task and Bug only. */
const ELIGIBLE = new Set(["task", "bug"]);

export function isAiWorkerEligibleIssueType(issueType: string | null | undefined): boolean {
  if (!issueType?.trim()) return false;
  return ELIGIBLE.has(issueType.trim().toLowerCase());
}

export function aiWorkerEligibleTypeLabel(): string {
  return "Task and Bug";
}
