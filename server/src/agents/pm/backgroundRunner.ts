import { withOrganizationContext } from "../../api/orgRequestContext";
import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";
import { autoStartEngineeringFromVirin } from "./autoStartEngineering";
import { isHandoffTransferred } from "./handoffStatus";
import { pmAnalysisStore } from "./store";

const running = new Set<string>();
const cancelled = new Set<string>();

export class PmAnalysisCancelledError extends Error {
  constructor(message = "Cancelled by user") {
    super(message);
    this.name = "PmAnalysisCancelledError";
  }
}

export function isPmAnalysisRunning(jiraKey: string): boolean {
  return running.has(jiraKey.trim().toUpperCase());
}

export function isPmAnalysisCancelled(jiraKey: string): boolean {
  return cancelled.has(jiraKey.trim().toUpperCase());
}

export function assertPmAnalysisNotCancelled(jiraKey: string): void {
  if (isPmAnalysisCancelled(jiraKey)) {
    throw new PmAnalysisCancelledError();
  }
}

export function requestPmAnalysisCancel(jiraKey: string): boolean {
  const key = jiraKey.trim().toUpperCase();
  const record = pmAnalysisStore.get(key);
  const active =
    running.has(key) ||
    record?.status === "RUNNING" ||
    record?.status === "AWAITING_INPUT" ||
    record?.status === "AWAITING_CONFIRMATION";
  if (!active) return false;

  cancelled.add(key);
  pmAnalysisStore.setStatus(key, "CANCELLED", "Cancelled by user");
  pmAnalysisStore.setCurrentStage(key, null);
  return true;
}

function clearPmAnalysisCancel(jiraKey: string): void {
  cancelled.delete(jiraKey.trim().toUpperCase());
}

/** Fire-and-forget Virin stage runner (shared by API routes and Jira intake). */
export function startPmAnalysisInBackground(
  jiraKey: string,
  run: () => Promise<unknown>,
  options?: { organizationId?: string }
): void {
  const key = jiraKey.trim().toUpperCase();
  if (running.has(key)) return;
  running.add(key);
  clearPmAnalysisCancel(key);

  const capturedOrgId = options?.organizationId ?? getActiveOrganizationId();

  const execute = async () => {
    if (capturedOrgId) {
      return withOrganizationContext(capturedOrgId, run);
    }
    return run();
  };

  void execute()
    .catch((err) => {
      if (err instanceof PmAnalysisCancelledError) return;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, jiraKey: key }, "Virin background run failed");
      const existing = pmAnalysisStore.get(key);
      if (existing?.status === "RUNNING") {
        pmAnalysisStore.setStatus(key, "FAILED", message);
      }
    })
    .finally(() => {
      running.delete(key);
      clearPmAnalysisCancel(key);

      const record = pmAnalysisStore.get(key);
      if (
        record?.status === "COMPLETED" &&
        record.generatedPrd &&
        !isHandoffTransferred(record.engineeringHandoff?.status)
      ) {
        void autoStartEngineeringFromVirin(key);
      }
    });
}
