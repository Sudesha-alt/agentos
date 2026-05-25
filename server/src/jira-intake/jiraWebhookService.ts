import { jiraFetch } from "./jiraApiClient";

export interface JiraAdminWebhook {
  id?: number;
  name: string;
  url: string;
  enabled?: boolean;
  events?: string[];
  secret?: string;
  self?: string;
}

const WEBHOOK_NAME = "AgentOS";

export async function fetchJiraCurrentUser(): Promise<{
  email: string;
  displayName: string;
  accountId: string;
}> {
  const me = (await jiraFetch("/rest/api/3/myself")) as {
    emailAddress?: string;
    displayName?: string;
    accountId?: string;
  };
  if (!me.emailAddress) {
    throw new Error("Could not read email from Jira — enter service account email manually");
  }
  return {
    email: me.emailAddress,
    displayName: me.displayName || me.emailAddress,
    accountId: me.accountId || "",
  };
}

export async function listAdminWebhooks(): Promise<JiraAdminWebhook[]> {
  const data = (await jiraFetch("/rest/webhooks/1.0/webhook")) as
    | JiraAdminWebhook[]
    | { values?: JiraAdminWebhook[] };
  if (Array.isArray(data)) return data;
  return data?.values ?? [];
}

export async function findWebhookByUrl(
  targetUrl: string
): Promise<JiraAdminWebhook | null> {
  const hooks = await listAdminWebhooks();
  const normalized = targetUrl.replace(/\/$/, "");
  return (
    hooks.find((h) => h.url?.replace(/\/$/, "") === normalized) ?? null
  );
}

export async function registerAdminWebhook(input: {
  webhookUrl: string;
  secret: string;
  projectKey?: string | null;
}): Promise<JiraAdminWebhook> {
  const existing = await findWebhookByUrl(input.webhookUrl);
  if (existing) {
    return existing;
  }

  const jqlFilter = input.projectKey
    ? `project = "${input.projectKey}"`
    : undefined;

  const body: Record<string, unknown> = {
    name: WEBHOOK_NAME,
    description: "AgentOS pipeline + AI Worker intake",
    url: input.webhookUrl,
    excludeBody: false,
    enabled: true,
    events: ["jira:issue_created", "jira:issue_updated"],
    secret: input.secret,
  };

  if (jqlFilter) {
    body.filters = { "issue-related-events-section": jqlFilter };
  }

  const created = (await jiraFetch("/rest/webhooks/1.0/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  })) as JiraAdminWebhook;

  return created;
}

export async function ensureAgentosWebhook(input: {
  webhookUrl: string;
  secret: string;
  projectKey?: string | null;
}): Promise<{ registered: boolean; webhook: JiraAdminWebhook; created: boolean }> {
  const existing = await findWebhookByUrl(input.webhookUrl);
  if (existing) {
    return { registered: true, webhook: existing, created: false };
  }

  try {
    const webhook = await registerAdminWebhook(input);
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
        "Jira admin permission required to auto-create webhooks. Use the link below to add it manually in Jira settings."
      );
    }
    throw err;
  }
}
