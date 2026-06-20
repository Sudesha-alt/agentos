import { pipelineJiraFetch } from "./client";
import { validatePipelineJiraConfig } from "./credentialsStore";
import {
  loadOrganizationJiraConfig,
  purgeOrganizationJiraIntegration,
} from "../../organization/jiraConfigStore";
import { withOrganizationContext } from "../../api/orgRequestContext";

const lastReconcileAt = new Map<string, number>();
const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;

function shouldPurgeJiraIntegration(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Jira OAuth tokens are missing") ||
    msg.includes("invalid_grant") ||
    /Pipeline Jira API (401|403)/.test(msg) ||
    /Unauthorized|scope does not match/i.test(msg)
  );
}

/**
 * If Jira was revoked in Atlassian or credentials are corrupt, remove the org
 * integration so the UI shows a clean reconnect flow.
 */
export async function reconcileOrganizationJiraIntegration(
  organizationId: string,
  options?: { force?: boolean }
): Promise<{ purged: boolean }> {
  const row = await loadOrganizationJiraConfig(organizationId);
  if (!row) return { purged: false };

  if (
    row.authMethod === "oauth" &&
    !(row.cloudId?.trim() && row.accessToken?.trim())
  ) {
    await purgeOrganizationJiraIntegration(organizationId);
    lastReconcileAt.delete(organizationId);
    return { purged: true };
  }

  const last = lastReconcileAt.get(organizationId) ?? 0;
  const staleCheck = options?.force || Date.now() - last >= RECONCILE_INTERVAL_MS;
  if (!staleCheck) {
    return { purged: false };
  }
  lastReconcileAt.set(organizationId, Date.now());

  try {
    await withOrganizationContext(organizationId, async () => {
      validatePipelineJiraConfig();
      await pipelineJiraFetch("/rest/api/3/myself");
    });
    return { purged: false };
  } catch (err) {
    if (!shouldPurgeJiraIntegration(err)) {
      return { purged: false };
    }
    await purgeOrganizationJiraIntegration(organizationId);
    lastReconcileAt.delete(organizationId);
    return { purged: true };
  }
}
