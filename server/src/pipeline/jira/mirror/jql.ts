import { getPipelineJiraMirrorConfig } from "../config";
import { getActivePipelineJiraCredentials } from "../credentialsStore";

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildMirrorBackfillJql(projectKeys?: string[]): string {
  const cfg = getPipelineJiraMirrorConfig();
  const creds = getActivePipelineJiraCredentials();
  const keys = projectKeys?.length ? projectKeys : creds.projectKeys;

  const clauses: string[] = [];

  if (keys.length === 1) {
    clauses.push(`project = "${escapeJqlString(keys[0])}"`);
  } else if (keys.length > 1) {
    const list = keys.map((k) => `"${escapeJqlString(k)}"`).join(", ");
    clauses.push(`project in (${list})`);
  }

  const statusList = cfg.statuses
    .map((s) => `"${escapeJqlString(s)}"`)
    .join(", ");
  clauses.push(`status in (${statusList})`);

  const typeList = cfg.issueTypes
    .map((t) => `"${escapeJqlString(t)}"`)
    .join(", ");
  clauses.push(`issuetype in (${typeList})`);

  clauses.push(`updated >= -${cfg.months * 30}d`);

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}
