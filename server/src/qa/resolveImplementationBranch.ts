import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import {
  resolveEngineeringBranchName,
  resolveFallbackApiPushBranch,
} from "../engineering/engineeringWorkspace";
import { resolveCodingBranchName } from "../engineeringCodingAgent/inputBuilder";
import { auditRepo } from "../db/repositories/auditRepo";

/** Branch where Ananta pushed implementation artifacts for QA to inspect. */
export async function resolveImplementationBranchForQa(
  pipelineId: string,
  jiraKey: string
): Promise<string> {
  const logs = await auditRepo.listForPipeline(pipelineId, 100);
  const pushLog = logs.find((log) => log.event === "ENGINEERING_PUSHED_TO_BRANCH");
  const targetBranch = (pushLog?.metadata as { targetBranch?: string } | null)?.targetBranch;
  if (targetBranch?.trim()) {
    return targetBranch.trim();
  }

  const codingLog = logs.find((log) => log.event === "ENGINEERING_CODING_COMPLETED");
  const branchFromCoding = (codingLog?.metadata as { implementationBranch?: string } | null)
    ?.implementationBranch;
  if (branchFromCoding?.trim()) {
    return branchFromCoding.trim();
  }

  if (process.env.ENGINEERING_TARGET_BRANCH?.trim()) {
    return process.env.ENGINEERING_TARGET_BRANCH.trim();
  }

  const scope = resolveRepoScope();
  return (
    resolveEngineeringBranchName(jiraKey) ||
    resolveFallbackApiPushBranch() ||
    process.env.QA_DEFAULT_BRANCH?.trim() ||
    process.env.GITHUB_DEFAULT_BRANCH?.trim() ||
    scope?.defaultBranch ||
    resolveCodingBranchName()
  );
}
