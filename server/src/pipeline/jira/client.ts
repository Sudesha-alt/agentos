import { JiraClient } from "../../integrations/jiraClient";
import {
  getActivePipelineJiraCredentials,
  validatePipelineJiraConfig,
} from "./credentialsStore";

/** Lane 2 Jira REST client — always uses pipeline credentials (not intake). */
export function getPipelineJiraClient(): JiraClient {
  const creds = getActivePipelineJiraCredentials();
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
  validatePipelineJiraConfig();
  const creds = getActivePipelineJiraCredentials();
  const url = `${creds.baseUrl}${path}`;
  const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString(
    "base64"
  );

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
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
  };
  if (!me.emailAddress) {
    throw new Error("Could not read email from Jira — enter it manually");
  }
  return {
    email: me.emailAddress,
    displayName: me.displayName || me.emailAddress,
  };
}
