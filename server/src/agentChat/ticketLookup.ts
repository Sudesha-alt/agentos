import { pmAnalysisStore } from "../agents/pm/store";
import { getJiraIssueByKey } from "../jira-sync/issueRepository";
import { getPipelineJiraClient } from "../pipeline/jira/client";
import { logger } from "../utils/logger";

export interface ChatTicketLookupResult {
  jiraKey: string;
  found: boolean;
  source: "synced" | "live_jira" | "analysis_only" | "none";
  summary?: string;
  description?: string;
  issueType?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  components?: string[];
  analysis?: {
    status?: string;
    currentStage?: string;
    discoverySummary?: string;
  };
}

async function fetchLiveJiraIssue(jiraKey: string) {
  try {
    const issue = (await getPipelineJiraClient().getIssue(jiraKey)) as {
      key?: string;
      fields?: Record<string, unknown>;
    };
    const fields = issue.fields ?? {};
    const status = fields.status as { name?: string } | undefined;
    const issuetype = fields.issuetype as { name?: string } | undefined;
    const priority = fields.priority as { name?: string } | undefined;
    const labels = (fields.labels as string[] | undefined) ?? [];
    const components =
      (fields.components as Array<{ name?: string }> | undefined)?.map(
        (c) => c.name ?? ""
      ) ?? [];
    const description =
      typeof fields.description === "string"
        ? fields.description
        : JSON.stringify(fields.description ?? "");

    return {
      jiraKey: issue.key ?? jiraKey,
      summary: String(fields.summary ?? ""),
      description,
      issueType: issuetype?.name,
      status: status?.name,
      priority: priority?.name,
      labels,
      components: components.filter(Boolean),
    };
  } catch (err) {
    logger.warn({ err, jiraKey }, "chat ticket lookup: live Jira failed");
    return null;
  }
}

export async function lookupJiraTicketForChat(
  jiraKeyInput: string
): Promise<ChatTicketLookupResult> {
  const jiraKey = jiraKeyInput.trim().toUpperCase();
  if (!jiraKey) {
    return { jiraKey: jiraKeyInput, found: false, source: "none" };
  }

  const analysisRecord = pmAnalysisStore.get(jiraKey);
  const analysis = analysisRecord
    ? {
        status: analysisRecord.status,
        currentStage: analysisRecord.currentStage ?? undefined,
        discoverySummary: analysisRecord.questionMode?.discoverySummary,
      }
    : undefined;

  try {
    const synced = await getJiraIssueByKey(jiraKey);
    if (synced) {
      const labels = Array.isArray(synced.labels) ? (synced.labels as string[]) : [];
      const components = Array.isArray(synced.components)
        ? (synced.components as string[])
        : [];
      return {
        jiraKey,
        found: true,
        source: "synced",
        summary: synced.summary,
        description: synced.description ?? undefined,
        issueType: synced.issueType,
        status: synced.status,
        priority: synced.priority ?? undefined,
        labels,
        components,
        analysis,
      };
    }
  } catch {
    /* try live */
  }

  const live = await fetchLiveJiraIssue(jiraKey);
  if (live) {
    return {
      jiraKey,
      found: true,
      source: "live_jira",
      summary: live.summary,
      description: live.description,
      issueType: live.issueType,
      status: live.status,
      priority: live.priority,
      labels: live.labels,
      components: live.components,
      analysis,
    };
  }

  if (analysis) {
    return {
      jiraKey,
      found: true,
      source: "analysis_only",
      summary: analysisRecord?.jiraKey === jiraKey ? `Ticket ${jiraKey}` : undefined,
      analysis,
    };
  }

  return { jiraKey, found: false, source: "none" };
}
