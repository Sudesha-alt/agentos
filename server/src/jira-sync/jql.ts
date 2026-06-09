import { getActivePipelineJiraCredentials } from "../pipeline/jira/credentialsStore";
import { escapeJqlString } from "../jira-intake/jiraApiClient";

function projectClause(projectKeys: string[]): string | null {
  if (projectKeys.length === 1) {
    return `project = "${escapeJqlString(projectKeys[0])}"`;
  }
  if (projectKeys.length > 1) {
    const list = projectKeys.map((k) => `"${escapeJqlString(k)}"`).join(", ");
    return `project in (${list})`;
  }
  return null;
}

export function buildFullSyncJql(projectKeys?: string[]): string {
  const creds = getActivePipelineJiraCredentials();
  const keys = projectKeys?.length ? projectKeys : creds.projectKeys;
  const clause = projectClause(keys);
  if (!clause) return "ORDER BY updated DESC";
  return `${clause} ORDER BY updated DESC`;
}

export function buildIncrementalSyncJql(
  since: Date,
  projectKeys?: string[]
): string {
  const creds = getActivePipelineJiraCredentials();
  const keys = projectKeys?.length ? projectKeys : creds.projectKeys;
  const sinceStr = since.toISOString().slice(0, 19).replace("T", " ");
  const updatedClause = `updated >= "${sinceStr}"`;
  const clause = projectClause(keys);
  if (!clause) return `${updatedClause} ORDER BY updated DESC`;
  return `${clause} AND ${updatedClause} ORDER BY updated DESC`;
}
