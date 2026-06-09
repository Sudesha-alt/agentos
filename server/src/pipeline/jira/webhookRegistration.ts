import { pipelineJiraFetch } from "./client";

export interface JiraAdminWebhook {
  id?: number;
  name: string;
  url: string;
  enabled?: boolean;
  events?: string[];
  secret?: string;
  self?: string;
}

const WEBHOOK_NAME = "AgentOS Pipeline";

export async function listPipelineAdminWebhooks(): Promise<JiraAdminWebhook[]> {
  const data = (await pipelineJiraFetch("/rest/webhooks/1.0/webhook")) as
    | JiraAdminWebhook[]
    | { values?: JiraAdminWebhook[] };
  if (Array.isArray(data)) return data;
  return data?.values ?? [];
}

export async function findPipelineWebhookByUrl(
  targetUrl: string
): Promise<JiraAdminWebhook | null> {
  const hooks = await listPipelineAdminWebhooks();
  const normalized = targetUrl.replace(/\/$/, "");
  return hooks.find((h) => h.url?.replace(/\/$/, "") === normalized) ?? null;
}

export async function registerPipelineAdminWebhook(input: {
  webhookUrl: string;
  secret: string;
  projectKey?: string | null;
}): Promise<JiraAdminWebhook> {
  const existing = await findPipelineWebhookByUrl(input.webhookUrl);
  if (existing) return existing;

  const jqlFilter = input.projectKey
    ? `project = "${input.projectKey}"`
    : undefined;

  const body: Record<string, unknown> = {
    name: WEBHOOK_NAME,
    description: "AgentOS — full Jira sync, AI Worker intake, and RAG embedding",
    url: input.webhookUrl,
    excludeBody: false,
    enabled: true,
    events: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"],
    secret: input.secret,
  };

  if (jqlFilter) {
    body.filters = { "issue-related-events-section": jqlFilter };
  }

  return (await pipelineJiraFetch("/rest/webhooks/1.0/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  })) as JiraAdminWebhook;
}

export async function ensurePipelineJiraWebhook(input: {
  webhookUrl: string;
  secret: string;
  projectKey?: string | null;
}): Promise<{ registered: boolean; webhook: JiraAdminWebhook; created: boolean }> {
  const existing = await findPipelineWebhookByUrl(input.webhookUrl);
  if (existing) {
    return { registered: true, webhook: existing, created: false };
  }

  try {
    const webhook = await registerPipelineAdminWebhook(input);
    return { registered: true, webhook, created: true };
  } catch (err) {
    if (!input.webhookUrl.startsWith("https://")) {
      throw new Error(
        "Jira requires an HTTPS webhook URL. Set PUBLIC_API_URL to your Render/ngrok HTTPS URL."
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("403") || message.includes("401")) {
      throw new Error(
        "Jira admin permission required to auto-create webhooks. Add the pipeline webhook manually in Jira settings."
      );
    }
    throw err;
  }
}
