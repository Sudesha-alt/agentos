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

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(opts?: { baseUrl?: string; email?: string; apiToken?: string }) {
    const baseUrl = opts?.baseUrl ?? process.env.JIRA_BASE_URL ?? "";
    const email = opts?.email ?? process.env.JIRA_EMAIL ?? "";
    const apiToken = opts?.apiToken ?? process.env.JIRA_API_TOKEN ?? "";
    if (!baseUrl || !email || !apiToken) {
      logger.warn("Jira credentials not fully configured");
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return retry(async () => {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: this.authHeader,
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
    const params = new URLSearchParams({
      jql,
      maxResults: String(options.maxResults ?? 10),
    });
    if (options.fields?.length) {
      params.set("fields", options.fields.join(","));
    }
    return this.request(`/rest/api/3/search?${params.toString()}`);
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
