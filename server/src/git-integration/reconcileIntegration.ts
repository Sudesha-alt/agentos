import { loadOrganizationGitConfig, purgeOrganizationGitIntegration } from "../organization/gitConfigStore";
import {
  getInstallation,
  isGithubAppConfigured,
  isGithubInstallationMissingError,
} from "../integrations/git/githubApp";
import { logger } from "../utils/logger";

const lastReconcileAt = new Map<string, number>();
const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * If the GitHub App was uninstalled on GitHub, remove the org integration
 * so the UI shows a clean reconnect flow.
 */
export async function reconcileOrganizationGithubIntegration(
  organizationId: string,
  options?: { force?: boolean }
): Promise<{ purged: boolean }> {
  const config = await loadOrganizationGitConfig(organizationId);
  if (!config?.installationId?.trim()) {
    return { purged: false };
  }
  if (!isGithubAppConfigured()) {
    return { purged: false };
  }

  const last = lastReconcileAt.get(organizationId) ?? 0;
  if (!options?.force && Date.now() - last < RECONCILE_INTERVAL_MS) {
    return { purged: false };
  }
  lastReconcileAt.set(organizationId, Date.now());

  try {
    await getInstallation(config.installationId);
    return { purged: false };
  } catch (err) {
    if (!isGithubInstallationMissingError(err)) {
      return { purged: false };
    }
    logger.info(
      { organizationId, installationId: config.installationId },
      "github app uninstalled — purging org git integration"
    );
    await purgeOrganizationGitIntegration(organizationId);
    lastReconcileAt.delete(organizationId);
    return { purged: true };
  }
}
