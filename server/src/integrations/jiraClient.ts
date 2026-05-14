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

  addComment(jiraKey: string, comment: JiraComment): Promise<unknown> {
    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(jiraKey)}/comment`,
      { method: "POST", body: JSON.stringify(comment) }
    );
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
