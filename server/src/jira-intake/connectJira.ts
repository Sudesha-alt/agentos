import {
  applyColumnMappingFromSelection,
  getBoardColumnsOrdered,
} from "./boardColumnsService";
import { validateJiraConfig } from "./config";
import { jiraFetch } from "./jiraApiClient";
import {
  getPublicJiraCredentials,
  saveJiraCredentials,
} from "./jiraCredentialsStore";
import { getIntegrationMapping } from "./integrationConfigStore";
import { fetchJiraCurrentUser, ensureAgentosWebhook } from "./jiraWebhookService";

export async function connectJira(input: {
  baseUrl: string;
  email?: string;
  apiToken?: string;
  boardId: string;
  webhookSecret?: string;
  webhookUrl?: string;
  autoRegisterWebhook?: boolean;
}) {
  const prior = getPublicJiraCredentials();
  let email = input.email?.trim() || prior.email || "";

  if (input.apiToken?.trim()) {
    saveJiraCredentials({
      baseUrl: input.baseUrl,
      email: email || "pending@connect",
      apiToken: input.apiToken,
      boardId: input.boardId,
      webhookSecret: input.webhookSecret,
    });
    try {
      const me = await fetchJiraCurrentUser();
      email = me.email;
      saveJiraCredentials({
        baseUrl: input.baseUrl,
        email,
        apiToken: input.apiToken,
        boardId: input.boardId,
        webhookSecret: input.webhookSecret,
      });
    } catch {
      if (!email) throw new Error("apiToken valid but could not fetch Jira profile — enter email");
    }
  } else {
    saveJiraCredentials({
      baseUrl: input.baseUrl,
      email,
      apiToken: input.apiToken,
      boardId: input.boardId,
      webhookSecret: input.webhookSecret,
    });
  }

  validateJiraConfig();

  const boardId = input.boardId.trim();
  const board = (await jiraFetch(`/rest/agile/1.0/board/${boardId}`)) as {
    name?: string;
    location?: { projectName?: string; projectKey?: string };
  };

  const columns = await getBoardColumnsOrdered();

  let mapping = getIntegrationMapping();
  if (
    columns.length >= 2 &&
    !mapping.workingColumnName &&
    !mapping.nextColumnName
  ) {
    mapping = applyColumnMappingFromSelection({
      workingColumnName: columns[0].name,
      nextColumnName: columns[1].name,
      columns,
    });
  }

  const jira = getPublicJiraCredentials();
  let webhookRegistration: {
    registered: boolean;
    created: boolean;
    jiraWebhookId?: number;
    error?: string;
  } = { registered: false, created: false };

  if (input.autoRegisterWebhook !== false && input.webhookUrl && jira.webhookSecret) {
    try {
      const result = await ensureAgentosWebhook({
        webhookUrl: input.webhookUrl,
        secret: jira.webhookSecret,
        projectKey: board.location?.projectKey || null,
      });
      webhookRegistration = {
        registered: result.registered,
        created: result.created,
        jiraWebhookId: result.webhook.id,
      };
    } catch (err) {
      webhookRegistration = {
        registered: false,
        created: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    connected: true,
    jira,
    board: {
      id: boardId,
      name: board.name || `Board ${boardId}`,
      projectKey: board.location?.projectKey || null,
      projectName: board.location?.projectName || null,
    },
    columns,
    mapping,
    webhookRegistration,
  };
}
