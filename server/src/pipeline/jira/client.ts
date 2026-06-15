import { JiraClient } from "../../integrations/jiraClient";
import { ensureFreshJiraOAuthToken } from "../../jira-oauth/tokenRefresh";
import {
  getActivePipelineJiraCredentials,
  validatePipelineJiraConfig,
} from "./credentialsStore";

export async function resolveJiraApiBaseAndAuth(): Promise<{
  apiBase: string;
  authorization: string;
}> {
  validatePipelineJiraConfig();
  const creds = getActivePipelineJiraCredentials();

  if (creds.authMethod === "oauth") {
    await ensureFreshJiraOAuthToken();
    const fresh = getActivePipelineJiraCredentials();
    if (!fresh.cloudId || !fresh.accessToken) {
      throw new Error("Jira OAuth tokens are missing");
    }
    return {
      apiBase: `https://api.atlassian.com/ex/jira/${fresh.cloudId}`,
      authorization: `Bearer ${fresh.accessToken}`,
    };
  }

  const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64");
  return {
    apiBase: creds.baseUrl,
    authorization: `Basic ${auth}`,
  };
}

/** Lane 2 Jira REST client — uses org pipeline credentials (OAuth or API token). */
export function getPipelineJiraClient(): JiraClient {
  const creds = getActivePipelineJiraCredentials();
  if (creds.authMethod === "oauth" && creds.cloudId) {
    return JiraClient.fromOAuth({
      cloudId: creds.cloudId,
      getAccessToken: async () => {
        await ensureFreshJiraOAuthToken();
        const fresh = getActivePipelineJiraCredentials();
        if (!fresh.accessToken) {
          throw new Error("Jira OAuth access token is missing");
        }
        return fresh.accessToken;
      },
    });
  }
  return new JiraClient({
    baseUrl: creds.baseUrl,
    email: creds.email,
    apiToken: creds.apiToken,
  });
}

export async function pipelineJiraFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const { apiBase, authorization } = await resolveJiraApiBaseAndAuth();
  const url = `${apiBase}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const obj = data as { errorMessages?: string[]; message?: string } | null;
    const msg =
      obj?.errorMessages?.join("; ") || obj?.message || text || res.statusText;
    throw new Error(`Pipeline Jira API ${res.status}: ${msg}`);
  }

  return data;
}

export async function fetchPipelineJiraCurrentUser(): Promise<{
  email: string;
  displayName: string;
}> {
  const me = (await pipelineJiraFetch("/rest/api/3/myself")) as {
    emailAddress?: string;
    displayName?: string;
    accountId?: string;
  };

  const email =
    me.emailAddress?.trim() ||
    (me.accountId ? `${me.accountId}@atlassian.oauth` : "");

  if (!email) {
    throw new Error("Could not read profile from Jira — enter email manually");
  }

  return {
    email,
    displayName: me.displayName || email,
  };
}
