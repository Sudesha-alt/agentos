import { logger } from "../utils/logger";
import { retry } from "../utils/retry";

/**
 * Minimal Jira REST v3 client. Only the endpoints the pipeline actually needs:
 * fetching a ticket, posting a comment, and attaching agent output as a
 * structured block. Auth is Basic email:token.
 */

export interface JiraComment {
  body: unknown;
}

export interface JiraIssueSearchResult<TIssue = unknown> {
  issues: TIssue[];
}

type JiraClientOAuthOpts = {
  cloudId: string;
  getAccessToken: () => Promise<string>;
};

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string | null;
  private readonly oauth: JiraClientOAuthOpts | null;

  constructor(
    opts?:
      | { baseUrl?: string; email?: string; apiToken?: string }
      | { oauth: JiraClientOAuthOpts }
  ) {
    if (opts && "oauth" in opts) {
      this.oauth = opts.oauth;
      this.baseUrl = "";
      this.authHeader = null;
      return;
    }

    const baseUrl = opts?.baseUrl ?? process.env.JIRA_BASE_URL ?? "";
    const email = opts?.email ?? process.env.JIRA_EMAIL ?? "";
    const apiToken = opts?.apiToken ?? process.env.JIRA_API_TOKEN ?? "";
    if (!baseUrl || !email || !apiToken) {
      logger.warn("Jira credentials not fully configured");
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
    this.oauth = null;
  }

  static fromOAuth(oauth: JiraClientOAuthOpts): JiraClient {
    return new JiraClient({ oauth });
  }

  private async resolveRequestAuth(): Promise<{ baseUrl: string; authHeader: string }> {
    if (this.oauth) {
      const token = await this.oauth.getAccessToken();
      return {
        baseUrl: `https://api.atlassian.com/ex/jira/${this.oauth.cloudId}`,
        authHeader: `Bearer ${token}`,
      };
    }
    if (!this.baseUrl || !this.authHeader) {
      throw new Error("Jira baseUrl not configured");
    }
    return { baseUrl: this.baseUrl, authHeader: this.authHeader };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { baseUrl, authHeader } = await this.resolveRequestAuth();
    return retry(async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authHeader,
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Jira ${init.method ?? "GET"} ${path} ${res.status}: ${body}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    });
  }

  getIssue(jiraKey: string): Promise<unknown> {
    return this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`);
  }

  getIssueWithFields<T = unknown>(jiraKey: string, fields: string[]): Promise<T> {
    const params = new URLSearchParams();
    if (fields.length > 0) {
      params.set("fields", fields.join(","));
    }
    const suffix = params.toString() ? `?${params}` : "";
    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(jiraKey)}${suffix}`
    );
  }

  searchIssues<TIssue = unknown>(
    jql: string,
    options: { fields?: string[]; maxResults?: number } = {}
  ): Promise<JiraIssueSearchResult<TIssue>> {
    const body: Record<string, unknown> = {
      jql,
      maxResults: options.maxResults ?? 10,
      fields: options.fields?.length ? options.fields : ["summary", "status", "issuetype"],
    };
    return this.request("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  addComment(jiraKey: string, comment: JiraComment): Promise<unknown> {
    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(jiraKey)}/comment`,
      { method: "POST", body: JSON.stringify(comment) }
    );
  }

  addPlainTextComment(jiraKey: string, text: string): Promise<unknown> {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    const content = paragraphs.flatMap((paragraph, index) => {
      const nodes = paragraph.split("\n").map((line) => ({
        type: "text" as const,
        text: line,
      }));
      const block =
        nodes.length === 1
          ? { type: "paragraph" as const, content: nodes }
          : {
              type: "paragraph" as const,
              content: [{ type: "text" as const, text: paragraph }],
            };
      return index < paragraphs.length - 1
        ? [block, { type: "paragraph" as const, content: [] }]
        : [block];
    });

    return this.addComment(jiraKey, {
      body: {
        type: "doc",
        version: 1,
        content: content.length ? content : [{ type: "paragraph", content: [{ type: "text", text }] }],
      },
    });
  }

  async addLabels(jiraKey: string, labelsToAdd: string[]): Promise<void> {
    if (!labelsToAdd.length) return;
    const issue = (await this.getIssue(jiraKey)) as {
      fields?: { labels?: string[] };
    };
    const existing = issue.fields?.labels ?? [];
    const merged = [...new Set([...existing, ...labelsToAdd])];
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields: { labels: merged } }),
    });
  }

  async updateStoryPoints(jiraKey: string, points: number): Promise<void> {
    const fieldId = process.env.JIRA_STORY_POINTS_FIELD;
    if (!fieldId) {
      logger.debug({ jiraKey, points }, "JIRA_STORY_POINTS_FIELD not set — skip story points");
      return;
    }
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields: { [fieldId]: points } }),
    });
  }

  async getTransitions(jiraKey: string): Promise<Array<{ id: string; name: string }>> {
    const data = (await this.request<{
      transitions?: Array<{ id: string; name: string }>;
    }>(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}/transitions`)) as {
      transitions?: Array<{ id: string; name: string }>;
    };
    return data.transitions ?? [];
  }

  async transitionIssue(jiraKey: string, transitionId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  async transitionToStatus(jiraKey: string, statusName: string): Promise<boolean> {
    const normalized = statusName.trim().toLowerCase();
    const transitions = await this.getTransitions(jiraKey);
    const match = transitions.find((t) => t.name.trim().toLowerCase() === normalized);
    if (!match) {
      logger.warn({ jiraKey, statusName, available: transitions.map((t) => t.name) }, "Jira transition not found");
      return false;
    }
    await this.transitionIssue(jiraKey, match.id);
    return true;
  }

  async getIssueLabels(jiraKey: string): Promise<string[]> {
    const issue = (await this.getIssue(jiraKey)) as {
      fields?: { labels?: string[] };
    };
    return issue.fields?.labels ?? [];
  }

  async updateIssueDescription(jiraKey: string, text: string): Promise<void> {
    const body = {
      body: {
        type: "doc",
        version: 1,
        content: text.split(/\n{2,}/).map((block) => ({
          type: "paragraph",
          content: [{ type: "text", text: block.trim() }],
        })),
      },
    };
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields: { description: body } }),
    });
  }

  addAttachmentNote(
    jiraKey: string,
    title: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    // Stored as an ADF comment block. Real attachments use a multipart upload;
    // for Phase 1 a structured comment is enough and reversible.
    const body = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: title }],
          },
          {
            type: "codeBlock",
            attrs: { language: "json" },
            content: [
              { type: "text", text: JSON.stringify(payload, null, 2) },
            ],
          },
        ],
      },
    };
    return this.addComment(jiraKey, body);
  }
}

export const jiraClient = new JiraClient();
